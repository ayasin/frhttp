'use strict';


var FRHttp = require('./lib/frhttp.js');
var server = FRHttp.createServer();

server.GET('/api/multiply/:first/:second').onValue(function (path) {
	path.process.on(
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
	path.process.on(
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

server.POST('/api/replay').onValue(function (path) {
	path.process.parseBody().render({
		params: [server.CONSTANTS.REQUEST_BODY],
		fn: function(writer, input) {
			writer.setStatus(201);
			writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
		}
	});
});

server.listen(8001);