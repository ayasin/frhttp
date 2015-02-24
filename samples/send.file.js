'use strict';

function createRoute(server) {
	server.GET('/samples/send.file').onValue(function (route) {
		route.render([], function(writer) {
			writer.writeFile('text/plain', './samples/send.file.js', false);
		});
	});

	server.GET('/samples/send.file/save').onValue(function (route) {
		route.render([], function(writer) {
			writer.writeFile('text/plain', './samples/send.file.js', 'send.file.js');
		});
	});
}

module.exports = createRoute;