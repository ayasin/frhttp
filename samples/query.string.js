'use strict';

function createRoute(server) {
	// try navigating to /samples/query.string?a=15&b=22
	server.GET('/samples/query.string').onValue(function (route) {
		route
			.when(server.WHEN.QUERY_STRING)
			.render([server.CONSTANTS.QUERY_VARS], function(writer, input) {
				writer.writeBody(input[server.CONSTANTS.QUERY_VARS]);
			});
	});
}

module.exports = createRoute;