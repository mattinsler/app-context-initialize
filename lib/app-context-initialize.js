var q = require('q');
var npm = require('npm');
var path = require('path');
var utils = require('./utils');
var isPlainObject = require('lodash.isplainobject');

var installDependencies = function(dependencies) {
  var d = q.defer();
  var modules = Array(dependencies.length);

  var count = 0;
  var finish = function(err) {
    if (err) {
      return d.reject(err);
    }

    if (++count === dependencies.length) {
      d.resolve(modules);
    }
  };

  if (dependencies.length === 0) {
    finish();
  } else {
    npm.load(function(err) {
      if (err) { return finish(err); }

      dependencies.forEach(function(dependency, index) {
        try {
          modules[index] = require(path.join(process.cwd(), 'node_modules', dependency));
          finish();
        } catch(err) {
          npm.commands.install(dependencies, function(err, data) {
            if (err) { return finish(err); }
            modules[index] = require(path.join(process.cwd(), 'node_modules', dependency));
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

  if (typeof(config) === 'string' && config[0] === '$') {
    var configString = config.slice(1);
    var configObject = utils.getValue(context.config, configString);
    if (configObject === null || configObject === undefined) {
      throw new Error('Could not resolve configuration value at ' + configString);
    }
    return configObject;
  }

  return config;
};

module.exports = function(opts) {
  return function(context) {
    var initializers = Object.keys(opts).map(function(name) {
      return {
        name: name,
        type: 'app-context-' + name,
        config: resolveConfig(context, opts[name])
      };
    });

    var dependencies = initializers.map(function(i) {return i.type});

    return installDependencies(dependencies).then(function(dependencies) {
      return initializers.reduce(function(lastPromise, initializer, index) {
        return lastPromise.then(function() {
          return dependencies[index](initializer.config)(context);
        });
      }, q());
    });
  };
};
