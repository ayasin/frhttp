FRHTTP [![Build Status](https://travis-ci.org/ayasin/frhttp.svg?branch=master)](https://travis-ci.org/ayasin/frhttp)
=========

> Simplicity is prerequisite for reliability.
>
> <sup><sub>-Edsger W. Dijkstra</sub></sup>

FRHTTP is a backend web framework designed to facilitate the development of functional reactive web services/sites.  Incidentally, FRHTTP stands for **F**unctional **R**eactive **H**ypertext **T**ransfer **P**rotocol.

## Key benefits: ##
* eliminates callback hell
* easy to reason about
* easier to test (since functions can be tested in isolation)
* FAR better error messages
* facilitates code reuse (potentially even with your frontend)
* can be used either standalone or as part of your existing Express project

## Install ##

```
npm install frhttp
```

## Quick Start ##
* Initialize your node project folder.
* Install FRHTTP (please see above).
* Copy the code below into your main javascript file, e.g. server.js.
* Run the app, e.g. `node server.js` 
* In your browser, open up the URL, http://localhost:8000/hello
* Enjoy your first FRHTTP application! 
```js
var FRHTTP = require('frhttp');

var server = FRHTTP.createServer();

server.GET('/hello').onValue(function (route) {
  route.when({
    name: 'hello_world',
    params: [],
    produces: ['message'],
    fn: function (produce, input) {
      produce.value('message', 'hello, world');
      produce.done();
    }
  }).render({
    params: ['message'],
    fn: function (writer, input) {
      writer.writeBody(input.message);
    }
  });
});

server.listen(8000);
```


## Detailed Docs ##

[Detailed docs can be found in the wiki](https://github.com/ayasin/frhttp/wiki)

## User Guide ##

*Note: this info is being migrated to the wiki along with additional details.  For now, if you're new, it's worth reading both*

### Creating a server ###

To create a server, import the FRHTTP library and call createServer.  The call should look something like this:

```js
var server = require('frhttp').createServer();
```

### Defining a route ###

Defining routes in FRHTTP is relatively easy.  Routes are separated by HTTP verbs (GET, POST, PUT, DELETE) and can be created or retrieved via similarly named methods on the server object.  The method calls return a stream (in usage here, conceptually similar to a promise) with an onValue method.  The onValue method takes a function which will receive the route.  Once you have the route you can set up the `when` functions as well as the render function.  Lets look at some code:

```js
server.GET('/api/isSquareRoot/:number/:possibleSqrt').onValue(function (route) {
	route.when({
		name: 'doubleIt',
		params: [server.CONSTANTS.URL_VARS],
		produces: ['sqrtToPow2'],
		fn: function(produce, input) {
			var possibleSqrt = +input[server.CONSTANTS.URL_VARS].possibleSqrt;
			produce.value('sqrtToPow2', possibleSqrt*possibleSqrt);
			produce.done();
		}
	}).when({
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

Lets analyze this code from the top.  First we see that we're configuring a GET route at `/api/isSquareRoot/:number/:possibleSqrt`.  The parts of the URL here with the `:` in front are "url variables".  This means that in our real URL, they'll be something else, but the frhttp executor will extract them for us into a field from which we can get a nice mapping from what we have here to what actually appeared in the URL.  We'll see this a few lines down.

Recall from earlier we mentioned that the GET (and in fact any server function other than listen) returns a stream.  We call the onValue method of that stream to get our actual route for configuration.

Once we have our route we can start configuring it.  A route has 2 phases, `process` and `render`.  In the process phase, we set up functions to be called when data is ready.  To do this, we use the `when` method of the route.  Note that `when` is chainable so we don't need to keep calling `route`.  `when` takes a function definition object.  Here's what that object contains:

field | required | description
------|----------|---------------
name | No | the name of the function, used for debugging and error reporting purposes. While this is optional it's highly recommended. 
params | No | the parameters you require.  These will be passed to you as an object to the second parameter to your function.  If you don't require any parameters you can omit this field.
produces | No | the parameters your function produces.
fn | Yes | the function to execute when all the parameters are ready.
enter exit, inject, takeMany | No | parameters for advanced usage described in the API section below

Our first when definition expects the url variables, and produces a field called `sqrtToPow2`, our second when definition (the order doesn't matter here, it would work just fine to make this the first function) takes the url variables and `sqrtToPow2` as inputs and produces a field called `passed`.  Finally our render function takes the url variables and `passed` as inputs to write out the result.

The function in the when definition takes 2 parameters.  First is the producer.  This has 4 methods:
```js
{
  value: function (name, value),
  done: function (),
  error: function(httpErrorCode, description)
  fromNodeCallback: function(produces, cbPosition, functionToWrap, thisBinding, functionArgsMinusCallback...)
}
```
You may call value to produce any values you have declared.  You may produce the same value multiple times (such as accepting an array and then producing each element as an individual value), and you may do so synchronously or asynchronously but you *MUST* call done once you've produced all the values you are going to produce unless you use fromNodeCallback.  You may *NOT* produce values you have not declared.  [You can find more details on the wiki](https://github.com/ayasin/frhttp/wiki/When#fn)

The render definition is quite similar to the process definition but for 2 factors.  First, there's only ever 1 render function, so there's no `when` method.  Second the first parameter to the render function is a writer not a producer.  The render function will always be called once no more producers can run unless there was an error.  Any parameters which aren't available but are requested by the render function will be present but null.  The writer has the following signature:
```js
{
  writeBody: function(body),
  writePartial: function(chunk),
  writeFile: function(type, filename, shouldDownloadFileName),
  setHeader: function(name, value),
  setCookie: function(name, value),
  setStatus: function(statusCode),
  done: function()
}
```

If you just want to write a JSON, HTML or text payload, writeBody does all the work necessary.  If you need to write something more complex (transmit a binary file for example), then you can use writePartial.  If you do *NOT* use `writeBody` you *MUST* set your own headers (Content-Length, etc) and you *MUST* call done.  If your render function is called, the status defaults to 200.  If you would like to send an alternative status (such as for a redirect), you should call setStatus before calling any write function.

For a detailed explination of the writer [check the wiki](https://github.com/ayasin/frhttp/wiki/Rendering#the-writer-object).

When this route executes, the system will run any functions that can run with available data.  In this case, that's the first `when` function because the url variables are ready.  The second function can't run because even though the url variables are ready, `sqrtToPow2` is not. Once the first function runs, it produces `sqrtToPow2`.  This allows the second function to run.  The run will proceed in this fashion until no more functions can be called based on the available data.  At this point the system will call the render function and produce output.

### Starting the server in standalone mode ###

Starting is standalone mode is quite simple.  Just run the listen method on the server with a port number like so:
```js
server.listen(8000); //8000 can be replaced with any valid and available port number
```

### Using as part of an Express/Connect/Etc app ###

Using a FRHTTP route in an Express/Connect app is only slightly more work than standalone mode.  Lets assume that your Express app is in the variable `app` and your FRHTTP server is in a variable called `server`.  The following code would execute a route on a get call:
```js
app.get('/api/doSomething', function(req, res) {
  server.TAP_GET('/api/doSomething').onValue(function (executor) {
    var url = require('url').parse(req.url);
    executor.execute(url, req, res, executor.inject);
  });
});
```

## API Guide ##

### createServer() ###

Returns a server object.  You can either use this directly or as part of an Express app as described below.

### Server Object ###

The server object exposes a number of methods related to registering and finding routes as well as several constants under the CONSTANTS field.  The server supports hanging routes off 5 REST verbs:
```js
GET(path)
POST(path)
PUT(path)
DELETE(path)
OPTIONS(path)
```
To achieve this, one would create a server like so:
```js 
server = require('frhttp').createServer(); 
```

Then call the verb on the server like so: 
```js
server.GET(/* your path here such as /api/client */).onValue(function (route) {
  // define your route here as explained below
});
```

The server object also supports finding existing routes for execution (in case you're adding this to an existing Express app).  These can be found at TAP_{VERB}:
```js
TAP_GET(path)
TAP_POST(path)
TAP_PUT(path)
TAP_DELETE(path)
TAP_OPTIONS(path)
```
You can look up a route like so:
```js
server.TAP_GET(/* some url */).onValue(function (executor) {
  //execute the route here as explained below
})
```
The last method on the Server object is the `listen` method.  
```js
listen(portNumber)
```
The single parameter to this method is a port number to bind to.  If you plan to use FRHTTP along side Express (to handle some of the routes), you do not need to call listen.

### Route definition ###

A route can be any valid URL path. 2 special characters exist in the route definition which cause the route to behave differently from a static route.  These are `:` and `*`.  `:` is a variable marker and `*` is a wildcard marker.  Any number of variables are allowed in a route, but only 0 or 1 wildcard markers should appear.  Also wildcard markers should be the last element in the route.

Example routes:
```
/a/path -- static route
/users/:userId/bin/:binId -- a path with 2 variables
/users/:userId/fileDir/* - a path with a variable and a wildcard
```

When a request arrives, the server parses the URL into it's constituent parts.  Variables are decoded into the CONSTANTS.URL_VARS object.  The variables are attached to this object using the keys specified in the path.  For example, in the 2 variable path in the example above the variables would be attached to the object at userId and binId.

A special variable exists for paths containing wildcards.  This variable is attached to URL_VARS at URL_VAR_WILDCARD and contains the remainder of the path.  In the example above, if we received a request at `/users/10/fileDir/public/profileImage.png` the URL_VAR_WILDCARD would be `public/profileImage.png`, and userId would be `10`.

### Route configuration object ###

The route configuration object is passed to the onValue function for every configuration function on the Server object (GET, POST, PUT, DELETE).  The object exposes the `process` property and a `render` config function.  The `process` property exposes the following properties and methods:

Field | Description
------|------------
when(def) | Connects a function to the route via the def object (described below).  Returns the process object so you can chain calls
inject(obj) | Allows you to preset fields needed by functions.  The obj should be a POJO (plain old javascript object).  Returns the process object so you can chain calls
render(def) | Defines the render function.  The def object is described below.  Returns undefined.  This should be the last method you call in setting up a chain and should only be called once.  Multiple calls to this method will replace the previous definition with the one in the latest call.
WHEN | A series of built in common when blocks.  You would use this like so `route.when(server.WHEN.BODY).when(...)...`

Built in `WHEN` blocks

Name | Description | Requires | Produces
-----|-------------|----------|---------
BODY | Read the body of the request (mostly applies to POST and PUT requests). | CONSTANTS.REQUEST | CONSTANTS.REQUEST_BODY

`when` definition object

field | required | description
------|----------|---------------
name | No | the name of the function, used for debugging and error reporting purposes. While this is optional it's highly recommended. 
params | No | the parameters you require.  These will be passed to you as an object to the second parameter to your function.  If you don't require any parameters you can omit this field.
produces | No | the parameters your function produces.
fn | Yes | the function to execute when all the parameters are ready.
triggerOn | No | an array of fields you wish to monitor.  See [the wiki](https://github.com/ayasin/frhttp/wiki/When#triggeron) for more details.
enter | No | a function that will be called with the parameter object prior to calling fn.  The value returned from the enter function is passed to fn.  To prevent fn from being called return undefined from the enter function (allowing enter to be used as a filter function).
exit | No | a function called after each value produced by fn.  The value returned by exit will be published instead of the value produced by fn.
takeMany | No | false by default.  If set to true, fn can be called each time params are available, otherwise fn will only be called the first time params are available.

One way to consider enter, fn and exit are: 
```js
stream.map(enter).flatMap(fn).map(exit)
```

`fn` signature:
```js
function fn(produce, input)
```

`produce` object:
```js
{
  value: function (name, value), // name: name of field to produce, value: value
  done: function (),
  error: function(httpErrorCode, description)
  fromNodeCallback: function(produces, cbPosition, functionToWrap, thisBinding, functionArgsMinusCallback...)
}
```

`render` definition object

field | required | description
------|----------|---------------
params | Yes | the parameters you require.  These will be passed to you as an object to the second parameter to your function.  Any value not produced during the process phase will be set to null in the second parameter to fn.
fn | Yes | the function to execute when all the parameters are ready.

`fn` signature:
```js
function fn(writer, input)
```

`writer` object:
```js
{
  writeBody: function(body),
  writeFile: function(type, fileToSend, downloadOnClient),
  writePartial: function(chunk),
  setHeader: function(name, value),
  setCookie: function(name, value),
  setStatus: function(statusCode),
  done: function()
}
```

See the [wiki page](https://github.com/ayasin/frhttp/wiki/Rendering#the-writer-object) for details

### Route executor object ###

If you plan to use frhttp via the listen method and not as part of an Express app, you do not need to worry about the route executor object.  

## Roadmap ##

* More docs/guides
* Demonstrate how to integrate with PassportJS
* Websocket support
