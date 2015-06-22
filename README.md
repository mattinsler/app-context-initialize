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
        [require('./initializers/s3', '$s3')],
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
