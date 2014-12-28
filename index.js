'use strict';
var FRHttp = require('./lib/frhttp.js');
var http = require('http');
/*
var server = FRHttp.createServer();

server.GET('/api/client/:clientId');
server.GET('/api/client/:clientId/package/:package').onValue(
	function() {
		server.TAP_GET('/api/client/123/package/34').onValue(function (val) {
			console.log(JSON.stringify(val));
		});
		server.TAP_GET('/api/client/123').log();
	}
);
*/

/*
http.createServer(function (req, res) {
	server.findAndExecute(req, res);
}).listen(8080);
*/

var bacon = require('baconjs');

var stream = new bacon.Bus();
var stream2 = new bacon.constant(1);
var stream3 = new bacon.Bus();


var endedOnError = stream.endOnError();

var fold = endedOnError.fold(0, function (memo, v) {
	console.log('called fold');
	return memo + v;
});

var onE = endedOnError.mapError(function (err) {
	//stream.end();
	//console.log('An error occured');
});

stream.onEnd(function () {
	console.log('Done, son!');
});


stream3.plug(onE);
stream3.plug(fold);

stream3.endOnError().log();

stream.push(new bacon.Next(1));
stream.push(new bacon.Next(1));

stream.error(12);
stream.push(new bacon.Next(92));
