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

module.exports = function() {
  var initializerConfigs = Array.prototype.slice.call(arguments).reduce(function(o, item) {
    if (Array.isArray(item)) {
      if (item.length === 1) {
        if (typeof(item[0]) === 'function') {
          o.push({
            method: item[0]
          });
        } else if (typeof(item[0]) === 'string') {
          o.push({
            name: item[0]
          });
        }
      } else if (item.length === 2) {
        if (typeof(item[0]) === 'function') {
          o.push({
            method: item[0],
            config: item[1]
          });
        } else if (typeof(item[0]) === 'string') {
          o.push({
            name: item[0],
            config: item[1]
          });
        }
      }
    } else if (isPlainObject(item)) {
      Object.keys(item).forEach(function(key) {
        o.push({
          name: key,
          config: item[key]
        });
      });
    } else if (typeof(item) === 'function') {
      o.push({
        method: item
      });
    } else if (typeof(item) === 'string') {
      o.push({
        name: item
      });
    } else {
      throw new Error('Invalid initializer config: ' + item);
    }

    return o;
  }, []);

  return function(context) {
    var dependencies = [];

    // resolve configs
    initializerConfigs.forEach(function(initializer) {
      if (initializer.config) {
        initializer.config = resolveConfig(context, initializer.config);
      }
      if (initializer.name) {
        dependencies.push('app-context-' + initializer.name);
      }
    });

    // install dependencies
    return installDependencies(dependencies).then(function(modules) {
      // resolve initializer names to methods
      initializerConfigs.forEach(function(initializer) {
        if (initializer.name && !initializer.method) {
          initializer.method = modules['app-context-' + initializer.name];
        }
      });

      // run through initializers
      return initializerConfigs.reduce(function(lastPromise, initializer) {
        return lastPromise.then(function() {
          return initializer.method(initializer.config)(context);
        });
      }, q());
    });
  };
};
