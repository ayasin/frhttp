function createRoute(server) {
	server.GET('/samples/cookie.sample/write').onValue(function (route) {
		route.render([], function (writer) {
			writer.setCookie('first_name', 'John');
			writer.setCookie('last_name', 'Doe');
			writer.writePartial('OK. See what was set at /samples/cookie.sample/read');
			writer.done();
		});
	});

	server.GET('/samples/cookie.sample/read').onValue(function (route) {
		route
			.when(server.WHEN.COOKIES)
			.render([server.CONSTANTS.REQUEST_COOKIES], function (writer, input) {
				writer.writeBody(input[server.CONSTANTS.REQUEST_COOKIES]);
			});
	});

	server.GET('/samples/cookie.sample/readHeaders').onValue(function (route) {
		route
			.when(server.WHEN.COOKIES)
			.when(server.WHEN.HEADERS)
			.render([server.CONSTANTS.REQUEST_COOKIES, server.CONSTANTS.REQUEST_HEADERS], function (writer, input) {
				var allHeaders = input[server.CONSTANTS.REQUEST_HEADERS];
				allHeaders.cookie = input[server.CONSTANTS.REQUEST_COOKIES];
				writer.writeBody(allHeaders);
			});
	});
}

module.exports = createRoute;