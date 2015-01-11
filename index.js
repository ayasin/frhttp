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
			params: ['mul'],
			fn: function(writer, input) {
				writer.write(input.mul);
				writer.done();
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
				writer.write(input.div);
				writer.done();
			}
		}
	);
});

server.listen(8001);