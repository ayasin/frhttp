'use strict';
var fs = require('fs');

function createRoute(server) {
	server.GET('/samples/from.callback').onValue(function (route) {
		route
			.when('stat this file',[],['fstat'], function (producer) {
				producer.fromNodeCallback(['fstat'], -1, fs.stat, null, './samples/from.callback.js');
			})
			.render(['fstat'], function(writer, input) {
				writer.writeBody(input.fstat);
			});
	});
}

module.exports = createRoute;