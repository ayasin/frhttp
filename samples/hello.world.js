'use strict';

function createRoute(server) {

	/**
	 * basic hello world.
	 */

	server.GET('/samples/hello').onValue(function (path) {
		path.render({
			params: [],
			fn: function (writer) {
				writer.writeBody('Hello, world!');
			}
		})
	});
}

module.exports = createRoute;