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

The server object exposes a number of methods related to registering and finding routes as well as several constants under the CONSTANTS field.  The server supports hanging routes off the 4 main REST verbs:

* GET
* POST
* PUT
* DELETE

To achieve this, one would create a server like so:
```js 
server = require('FRHTTP').createServer(); 
```

Then call the verb on the server like so: 
```js
server.GET(/* your path here such as /api/client */).onValue(function (route) {
  // define your route here as explained below
});
```

The server object also supports finding existing routes for execution (in case you're adding this to an existing Express app).  These can be found at TAP_{VERB}:

* TAP_GET
* TAP_POST
* TAP_PUT
* TAP_DELETE

You can look up a route like so:
```js
server.TAP_GET(/* some url */).onValue(function (excutor) {
  //execute the route here as explained below
})
```

## Roadmap ##

* Tests
* More docs
* Demonstrate how to integrate with PassportJS
* Samples folder
* Websocket support
