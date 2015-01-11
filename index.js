'use strict';


var FRHttp = require('./lib/frhttp.js');
var server = FRHttp.createServer();

server.GET('/api/multiply/:first/:second').onValue(function (path) {
		path.process.on(
			{
				name: 'multiply',
				enter: null,
				exit: null,
				params: ['request:url_vars'],
				produces: ['mul'],
				fn: function (produce, input) {
					produce.value('mul', input['request:url_vars'].first * input['request:url_vars'].second);
					produce.done();
				}
			}
		).render(
			{
				params: ['mul'],
				fn: function(writer, input) {
					writer.write(input.mul);
					writer.done();
				}
			}
		);
	});

server.listen(8009);


/*
var Bacon = require('baconjs');

var a = new Bacon.Bus();
var b = new Bacon.Bus();

var temp = Bacon.combineTemplate({
	a : a,
	b: a.sampledBy(b)
}).endOnError().onValue(function() {console.log('I was called'); return 33;}).onError(function (e) { console.log(e); });

a.push(15);
b.push(13);
a.end();
b.error('there was a problem');
*/