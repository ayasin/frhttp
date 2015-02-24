'use strict';

function createRoute(server) {
	/**
	 * write back whatever is posted.  Demonstrates parsing a body and setting status.
	 */

	server.POST('/samples/post.back').onValue(function (path) {
		path
			.when(server.WHEN.BODY)
			.render([server.CONSTANTS.REQUEST_BODY], function(writer, input) {
				writer.setStatus(200);
				writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
			});
	});
}

module.exports = createRoute;