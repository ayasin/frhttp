'use strict';


var FRHttp = require('./lib/frhttp.js');
var server = FRHttp.createServer();
var Bacon = require('baconjs');

var _ = require('lodash');
var bus = new Bacon.Bus();
bus.log();

server.GET('/api/multiply/:first/:second').onValue(function (path) {
	path.when(
		{
			name: 'multiply',
			enter: null,
			exit: null,
			params: ['request:url_vars', 'factor'],
			produces: ['mul'],
			fn: function (produce, input) {
				produce.value('mul', input['request:url_vars'].first * input['request:url_vars'].second * input.factor);
				produce.done();
			}
		}
	).inject({factor: 2}).inject({monkey: 'balls'}).render(
		{
			params: ['mul', 'factor'],
			fn: function(writer, input) {
				writer.writeBody('factoring in (' + input.factor + '): ' + input.mul);
			}
		}
	);
});

server.GET('/api/divide/:first/:second').onValue(function (path) {
	path.when(
		{
			name: 'divide',
			enter: null,
			exit: null,
			params: ['request:url_vars'],
			produces: ['div'],
			fn: function (produce, input) {
				var first = input['request:url_vars'].first;
				var second = input['request:url_vars'].second;
				if (+second === 0) {
					produce.error(500, 'Divide by 0');
					return;
				}
				produce.value('div', first / second);
				produce.done();
			}
		}
	).render(
		{
			params: ['div'],
			fn: function(writer, input) {
				writer.setHeader(server.CONSTANTS.HEADER_CONTENT_LENGTH, String(input.div).length);
				writer.setHeader(server.CONSTANTS.HEADER_CONTENT_TYPE, 'text/html');
				writer.writePartial(input.div);
				writer.done();
			}
		}
	);
});

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

server.POST('/api/replay').onValue(function (path) {
	path.parseBody().render({
		params: [server.CONSTANTS.REQUEST_BODY],
		fn: function(writer, input) {
			writer.setStatus(201);
			writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
		}
	});
});

server.GET('/api/factorial/:number').onValue(function (route) {
	route.when({
		name: 'setup',
		params: [server.CONSTANTS.URL_VARS],
		produces: ['max', 'total'],
		fn: function(produce, input) {
			produce.value('max', +input[server.CONSTANTS.URL_VARS].number);
			produce.value('total', {count: 1, current: 1});
			produce.done();
		}
	}).when({
		name: 'calculate',
		params: ['max', 'total'],
		produces: ['total'],
		takeMany: true,
		enter: function(input) {
			if (input.total.count > input.max) {
				return undefined;
			}
			return input;
		},
		fn: function(produce, input) {
			var ret = {
				count: input.total.count + 1,
				current: input.total.current * input.total.count
			};
			produce.value('total', ret);
			produce.done();
		}
	}).render(
		{
			params: ['max', 'total'],
			fn: function(writer, input) {
				writer.writeBody(String(input.total.current));
			}
		}
	)
});

server.GET('/api/matches').onValue(function (route) {
	route.inject({theBus : function () {return bus;}}).when({
			name: 'makes another bus',
			params: [],
			produces: ['anotherBus'],
			fn : function(producer) {
				producer.value('anotherBus', new Bacon.Bus());
				return producer.done();
			}
		}).render({
		params: ['theBus'],
		fn: function (writer, input) {
			//input.theBus().push(12);
			writer.writeBody('theBus() === bus: ' + (input.theBus() === bus));
		}
	});
});
server.listen(8001);