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

server.GET('/test/wild/*').onValue(function (path) {
	path.render({
		params: [server.CONSTANTS.URL_VARS],
		fn: function(writer, input) {
			var urlVars = input[server.CONSTANTS.URL_VARS];
			writer.writeBody(urlVars[server.CONSTANTS.URL_VAR_WILDCARD]);
		}
	});
});

server.GET('/test/wild/override').onValue(function (path) {
	path.render({
		params: [],
		fn: function(writer, input) {
			var urlVars = input[server.CONSTANTS.URL_VARS];
			writer.writeBody('no wildcard in route');
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
	path.when(server.WHEN.BODY).render({
		params: [server.CONSTANTS.REQUEST_BODY],
		fn: function(writer, input) {
			writer.setStatus(200);
			writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
		}
	});
});

server.GET('/test/processOrder').onValue(function (route) {
	route.when({
		name: 'callLast',
		params: ['order', 'callLast'],
		produces: ['callNext', 'order'],
		fn: function(produce, input) {
			produce.value('order',  input.order + 'callLast');
			produce.done();
		}
	}).when({
		name: 'callFirst',
		params: [],
		produces: ['callNext', 'order'],
		fn: function(produce, input) {
			produce.value('order', 'callFirst ');
			produce.value('callNext', 1);
			produce.done();
		}
	}).when({
		name: 'callNext',
		params: ['callNext', 'order'],
		produces: ['callLast', 'order'],
		fn: function(produce, input) {
			produce.value('order', input.order + 'callNext ');
			produce.value('callLast', 1);
			produce.done();
		}
	}).render({
		params: ['order'],
		fn: function (writer, input) {
			writer.writeBody(input.order);
		}
	});
});

server.GET('/test/skipNotProduced').onValue(function (route) {
	route.when({
		name: 'callLast fn',
		params: ['order', 'callLast'],
		produces: ['callNext', 'order'],
		fn: function(produce, input) {
			produce.value('order',  input.order + 'callLast');
			produce.done();
		}
	}).when({
		name: 'callFirst fn',
		params: [],
		produces: ['callLast', 'order'],
		fn: function(produce, input) {
			produce.value('order', 'callFirst ');
			produce.value('callLast', 1);
			produce.done();
		}
	}).when({
		name: 'callNext fn',
		params: ['order', 'callNext'],
		produces: ['callLast', 'order'],
		fn: function(produce, input) {
			produce.value('order', input.order + 'callNext ');
			produce.value('callLast', 1);
			produce.done();
		}
	}).render({
		params: ['order'],
		fn: function (writer, input) {
			writer.writeBody(input.order);
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

server.GET('/test/query.parse').onValue(function (route) {
	route.when(server.WHEN.QUERY_STRING)
		.render({
			params: [server.CONSTANTS.QUERY_VARS],
			fn: function(writer, input) {
				writer.writeBody(input[server.CONSTANTS.QUERY_VARS]);
			}
		});
});

server.listen(8008);
