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
		).inject({factor: 2}).on(
			{
				name: 'monkey_balls',
				enter: null,
				exit: null,
				params: ['request:url_vars', 'monkey_ball'],
				produces: ['mul_monkey'],
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

server.listen(8001);