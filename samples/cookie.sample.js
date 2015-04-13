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
			.when('', [server.CONSTANTS.REQUEST], ['value'], function (emit, input) {
				var value = input[server.CONSTANTS.REQUEST].headers.cookie;
				emit.value('value', value);
				emit.done();
			})
			.render(['value'], function (writer, input) {
				writer.writePartial(input.value);
				writer.done();
			});
	});
}

module.exports = createRoute;