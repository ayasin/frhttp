'use strict';
var fs = require('fs');

function createRoute(server) {
	server.GET('/samples/from.callback').onValue(function (route) {
		route.when({
			name: 'stat this file',
			params: [],
			produces: ['fstat'],
			fn: function (producer) {
				producer.fromNodeCallback(['fstat'], -1, fs.stat, null, './samples/from.callback.js');
			}
		}).render({
			params: ['fstat'],
			fn: function(writer, input) {
				writer.writeBody(input.fstat);
			}
		});
	});
}

module.exports = createRoute;