'use strict';


var FRHttp = require('../lib/frhttp.js');
var server = FRHttp.createServer();

server.GET('/test/hello').onValue(function (route) {
	route.render({
		params: [],
		fn: function(writer) {
			writer.writeBody('hello');
		}
	});
});

server.GET('/test/divide/:first/:second').onValue(function (path) {
	path.when(
		{
			name: 'divide',
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

server.GET('/test/multiply/:first/:second').onValue(function (path) {
	path.inject({factor: 2})
		.when(
		{
			name: 'multiply',
			params: ['request:url_vars', 'factor'],
			produces: ['mul'],
			fn: function (produce, input) {
				produce.value('mul', input['request:url_vars'].first * input['request:url_vars'].second * input.factor);
				produce.done();
			}
		}
	).render(
		{
			params: ['mul', 'factor'],
			fn: function(writer, input) {
				writer.writeBody('factoring in (' + input.factor + '): ' + input.mul);
			}
		}
	);
});

server.POST('/test/replay').onValue(function (path) {
	path.parseBody().render({
		params: [server.CONSTANTS.REQUEST_BODY],
		fn: function(writer, input) {
			writer.setStatus(200);
			writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
		}
	});
});

server.GET('/test/factorial/:number').onValue(function (route) {
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
	);
});

server.GET('/test/makeFactorialNegative/:number').onValue(function (route) {
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
		exit: function (obj) {
			if (obj.value.current > 0) {
				obj.value.current = -obj.value.current;
			}
			return obj;
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
	);
});

server.listen(8008);
