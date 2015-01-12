FRHTTP
=========

> ###Simplicity is prerequisite for reliability.###
>
> Edsger W. Dijkstra

FRHTTP is a backend web framework designed to facilitate the development of functional reactive web services/sites.

## Key benefits: ##
* eliminates callback hell
* easy to reason about
* easier to test (since functions can be tested in isolation)
* facilitates code reuse (potentially even with your frontend)
* can be used either standalone or as part of your existing Express project

## Quick Start ##
```js
var FRHTTP = require('frhttp');

var server = FRHTTP.createServer();

server.GET('/hello').onValue(function (route) {
  route.process.on({
    name: 'hello_world'
    params: [],
    produces: ['message'],
    fn: function (produce, input) {
      produce.value('message', 'hello, world');
      produce.done();
    }
  }).render({
    params: ['message'];
    fn: function (writer, input) {
      writer.writeBody(input.message);
    }
  });
});

server.listen(8000);
```

## API Guide ##

### createServer() ###

Returns a server object.  You can either use this directly or as part of an Express app as described below.

### Server Object ###



## Roadmap ##

* Tests
* More docs
* Demonstrate how to integrate with PassportJS
* Samples folder
* Websocket support
