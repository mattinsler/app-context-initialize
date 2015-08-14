# app-context-initialize

Simple initializer framework for use with app-context

### Installation

```bash
$ npm install --save app-context-initialize
```

### Usage

```javascript
var AppContext = require('app-context');
var initialize = require('app-context-initialize');

module.exports = AppContext.createContext({
  configure: function() {
    this.use(
      AppContext.RunLevel.Connected,

      // simple usage
      initialize({
        'access-mongo': {
          default: '$mongodb.default',
          crawllog: '$mongodb.crawllog'
        },
        redis: {
          default: '$redis.default',
          sessions: '$redis.sessions'
        }
      }),

      // multiple types of usage
      initialize(
        'no-config-initializer',
        ['access-mongo', '$mongodb.default'],
        ['access-mongo', 'mongodb://localhost/database'],
        ['connie', 'dir', 'config/' + APP.environment],
        [require('./initializers/s3'), '$s3'],
        {
          redis: {
            default: '$redis.default',
            sessions: '$redis.sessions'
          }
        }
      )
    );
  }
});
```

Alternatively you can use `app-context-initialize` to completely configure
your `AppContext`.

```javascript
var AppContext = require('app-context');
var initialize = require('app-context-initialize');

module.exports = AppContext.createContext({
  configure: function() {
    initialize.context(this, {
      configured: [
        ['connie', 'dir', 'config/' + APP.environment]
        // this is the same as (reading from the APP/context)
        ['connie', 'dir', 'config/${environment}']
        // or even (reading from environment variables)
        ['connie', 'dir', 'config/${NODE_ENV}']
      ],
      connected: {
        'access-mongo': {
          default: '$mongodb.default',
          users: '$mongodb.users'
        },
        redis: {
          sessions: 'redis.sessions'
        }
      }
    });
  }
});
```
