FRHTTP
=========

> Simplicity is prerequisite for reliability.
>
> <sup><sub>-Edsger W. Dijkstra</sub></sup>

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

## User Guide ##

### Creating a server ###

To create a server, import the FRHTTP library and call createServer.  The call should look something like this:

```js
var server = require('frhttp').createServer();
```

### Defining a route ###

Defining routes in FRHTTP is relatively easy.  Routes are separated by HTTP verbs (GET, POST, PUT, DELETE) and can be created or retrieved via similarly named methods on the server object.  The method calls return a stream (in usage here, conceptually similar to a promise) with an onValue method.  The onValue method takes a function which will receive the route.  Once you have the route you can set up the process functions as well as the render function.  Lets look at some code:

```js
server.GET('/api/isSquareRoot/:number/:possibleSqrt').onValue(function (route) {
	route.process.on({
		name: 'doubleIt',
		params: [server.CONSTANTS.URL_VARS],
		produces: ['sqrtToPow2'],
		fn: function(produce, input) {
			var possibleSqrt = +input[server.CONSTANTS.URL_VARS].possibleSqrt;
			produce.value('sqrtToPow2', possibleSqrt*possibleSqrt);
			produce.done();
		}
	}).on({
		name: 'checkIt',
		params: [server.CONSTANTS.URL_VARS, 'sqrtToPow2'],
		produces: ['passed'],
		fn: function(produce, input) {
			var checkNum = +input[server.CONSTANTS.URL_VARS].number;
			produce.value('passed', input.sqrtToPow2 === +checkNum);
			produce.done();
		}
	}).render({
		params: [server.CONSTANTS.URL_VARS, 'passed'],
		fn: function(writer, input) {
			var num = input[server.CONSTANTS.URL_VARS].number,
				possibleSqrt = input[server.CONSTANTS.URL_VARS].possibleSqrt;
			if (input.passed) {
				writer.writeBody(possibleSqrt + ' is the square root of ' + num);
			}
			else {
				writer.writeBody(possibleSqrt + ' is not the square root of ' + num);
			}
		}
	});
});
```

A couple of things to note before we get started on analyzing what's going on here.  First, the + in front of a variable such as on this line ```var possibleSqrt = +input[server.CONSTANTS.URL_VARS].possibleSqrt;``` converts whatever that field is to a number so we can do math operations on it.  Second, for illustrative purposes, we've intentionally taken a very long (horribly non-optimal) approach to figuring out if a number is the sqrt of another.

Lets analyze this code from the top.  First we see that we're configuring a GET route at `/api/isSquareRoot/:number/:possibleSqrt`.  The parts of the URL here with the `:` in front are "url variables".  This means that in our real URL, they'll be something else, but the frhttp executor will extract them for us into a field from which we can get a nice mapping from what we have here to what acutally appeared in the URL.  We'll see this a few lines down.

Recall from earlier we mentioned that the GET (and in fact any server function other than listen) returns a stream.  We call the onValue method of that stream to get our actual route for configuration.

Once we have our route we can start configuring it.  A route has 2 phases, `process` and `render`.  In the process phase, we set up functions to be called when data is ready.  To do this, we use the `on` method of process.  Note that `on` is chainable so we don't need to keep calling `route.process`.  `on` takes a function definition object.  Here's what that object contains:

field | required | description
------|----------|---------------
name | No | the name of the function, used for debugging and error reporting purposes. While this is optional it's highly recommended. 
params | No | the parameters you require.  These will be passed to you as an object to the second parameter to your function.  If you don't require any parameters you can omit this field.
produces | No | the parameters your function produces.
fn | Yes | the function to execute when all the parameters are ready.
enter exit, inject, takeMany | No | parameters for advanced usage described in the API section below

Our first on definition expects the url variables, and produces a field called `sqrtToPow2`, our second on definition (the order doesn't matter here, it would work just fine to make this the first function) takes the url variables and `sqrtToPow2` as inputs and produces a field called `passed`.  Finally our render function takes the url variables and `passed` as inputs to write out the result.

The function in the on definition takes 2 parameters.  First is the producer.  This has 3 methods:
```js
{
  value: function (name, value),
  done: function (),
  error: function(httpErrorCode, description)
}
```
You may call value to produce any values you have declared.  You may produce the same value multiple times or not produce a value you've declared, and you may do so syncronously or asynchronously but you *MUST* call done once you've produced all the values you are going to produce.  You may *NOT* produce values you have not declared.

The render definition is quite similar to the process definition but for 2 factors.  First, there's only ever 1 render function, so there's no `on` method.  Second the first parameter to the render function is a writer not a producer.  The render function will always be called once no more producers can run unless there was an error.  Any parameters which aren't available but are requested by the render function will be present but null.  The writer has the following signature:
```js
{
  writeBody: function(body),
  writePartial: function(chunk),
  setHeader: function(name, value),
  setCookie: function(name, value),
  done: function()
}
```

If you just want to write a JSON, HTML or text payload, writeBody does all the work necessary.  If you need to write something more complex (transmit a binary file for example), then you can use writePartial.  If you do *NOT* use `writeBody` you *MUST* set your own headers (Content-Length, etc) and you *MUST* call done.

When this route executes, the system will run any functions that can run with available data.  In this case, that's the first `on` function because the url variables are ready.  The second function can't run because even though the url variables are ready, `sqrtToPow2` is not. Once the first function runs, it produces `sqrtToPow2`.  This allows the second function to run.  The run will proceed in this fashion until no more functions can be called based on the available data.  At this point the system will call the render function and produce output.

### Starting the server in standalone mode ###

Starting is standalone mode is quite simple.  Just run the listen method on the server with a port number like so:
```js
server.listen(8000); //8000 can be replaced with any valid and available port number
```

### Using as part of an Express/Connect/Etc app ###

Using a FRHTTP route in an Express/Connect app is only slightly more work than standalone mode.  Lets assume that your Express app is in the variable `app`.  The following code would 

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
