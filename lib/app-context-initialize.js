var q = require('q');
var npm = require('npm');
var path = require('path');
var utils = require('./utils');
var isPlainObject = require('lodash.isplainobject');

var installDependencies = function(dependencies) {
  var d = q.defer();
  var modules = {};

  var count = 0;
  var finish = function(err) {
    if (err) {
      return d.reject(err);
    }

    if (++count === dependencies.length) {
      return d.resolve(modules);
    }
  };

  if (dependencies.length === 0) {
    finish();
  } else {
    npm.load(function(err) {
      if (err) { return finish(err); }

      dependencies.forEach(function(dependency) {
        try {
          modules[dependency] = require(path.join(process.cwd(), 'node_modules', dependency));
          finish();
        } catch(err) {
          npm.commands.install(dependencies, function(err, data) {
            if (err) { return finish(err); }
            modules[dependency] = require(path.join(process.cwd(), 'node_modules', dependency));
            finish();
          });
        }
      });
    });
  }

  return d.promise;
};

var resolveConfig = function(context, config) {
  if (isPlainObject(config)) {
    return Object.keys(config).reduce(function(o, k) {
      o[k] = resolveConfig(context, config[k]);
      return o;
    }, {});
  }

  if (typeof(config) === 'string') {
    // resolve all ${} to values in the context or environment
    var m;
    while (m = /\$\{([^\}]+)\}/.exec(config)) {
      var v = utils.getValue(context, m[1]) || process.env[m[1]];
      if (!v) { throw new Error('Could not resolve configuration value "' + config + '". "' + m[1] + '" does not exist in the context or as an environment variable.'); }
      config = config.replace(m[0], v);
    }

    if (config[0] === '$') {
      var configString = config.slice(1);
      var configObject = utils.getValue(context.config, configString);
      if (configObject === null || configObject === undefined) {
        throw new Error('Could not resolve configuration value "' + config + '". "' + configString + '" does not exist in the current configuration.');
      }
      return configObject;
    }
  }

  return config;
};

var createInitializer = function(opts) {
  return {
    installDependencies: function() {
      if (!opts.name) { return q({}); }
      return installDependencies(['app-context-' + opts.name]);
    },

    resolveConfig: function(context) {
      if (opts.config) {
        if (Array.isArray(opts.config)) {
          opts.arguments = opts.config.map(function(c) {
            return resolveConfig(context, c);
          });
        } else {
          opts.arguments = [resolveConfig(context, opts.config)];
        }
      } else {
        opts.arguments = [];
      }
    },

    execute: function(context) {
      var self = this;

      return this.installDependencies().then(function(modules) {
        if (opts.name && !opts.method) {
          opts.method = modules['app-context-' + opts.name];
        }

        self.resolveConfig(context);

        var fn = opts.arguments.length === 0 ? opts.method : opts.method.apply(null, opts.arguments);
        return fn(context);
      });
    }
  };
};

var resolveInitializers = function(args) {
  return args.reduce(function(o, item) {
    if (Array.isArray(item)) {
      if (item.length === 1) {
        if (typeof(item[0]) === 'function') {
          o.push(createInitializer({method: item[0]}));
        } else if (typeof(item[0]) === 'string') {
          o.push(createInitializer({name: item[0]}));
        }
      } else if (item.length >= 2) {
        if (typeof(item[0]) === 'function') {
          o.push(createInitializer({method: item[0], config: item.slice(1)}));
        } else if (typeof(item[0]) === 'string') {
          o.push(createInitializer({name: item[0], config: item.slice(1)}));
        }
      }
    } else if (isPlainObject(item)) {
      Object.keys(item).forEach(function(key) {
        o.push(createInitializer({name: key, config: item[key]}));
      });
    } else if (typeof(item) === 'function') {
      o.push(createInitializer({method: item}));
    } else if (typeof(item) === 'string') {
      o.push(createInitializer({name: item}));
    } else {
      throw new Error('Invalid initializer config: ' + item);
    }

    return o;
  }, []);
};

module.exports = function() {
  var initializers = resolveInitializers(Array.prototype.slice.call(arguments));
  
  return function(context) {
    return initializers.reduce(function(lastPromise, initializer) {
      return lastPromise.then(function() {
        return initializer.execute(context);
      });
    }, q());
  };
};

var objectToContextInitializers = function(obj) {
  return (Array.isArray(obj) ? obj : [obj]).map(function(a) {
    return resolveInitializers([a]);
  }).reduce(function(o, a) {
    return o.concat(a);
  }, []).map(function(initializer) {
    return function(context) {
      return initializer.execute(context);
    }
  });
};

module.exports.context = function(appContext, config) {
  if (config.setup) {
    appContext.use.apply(appContext, [1].concat(objectToContextInitializers(config.setup)));
  }
  if (config.configured) {
    appContext.use.apply(appContext, [3].concat(objectToContextInitializers(config.configured)));
  }
  if (config.connected) {
    appContext.use.apply(appContext, [5].concat(objectToContextInitializers(config.connected)));
  }
  if (config.initialized) {
    appContext.use.apply(appContext, [7].concat(objectToContextInitializers(config.initialized)));
  }
  if (config.running) {
    appContext.use.apply(appContext, [9].concat(objectToContextInitializers(config.running)));
  }
};
