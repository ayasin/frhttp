'use strict';

function createRoute(server) {
	/**
	 * write back whatever is posted.  Demonstrates parsing a body and setting status.
	 */

	server.POST('/samples/postBack').onValue(function (path) {
		path.parseBody().render({
			params: [server.CONSTANTS.REQUEST_BODY],
			fn: function(writer, input) {
				writer.setStatus(200);
				writer.writeBody('You sent ' + input[server.CONSTANTS.REQUEST_BODY]);
			}
		});
	});
}

module.exports = createRoute;