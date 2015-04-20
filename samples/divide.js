'use strict';

function createRoute(server) {
	/**
	 * Divide 2 numbers.  Demonstrates URL_VARS as well producing an error, setting headers and writing a body one part at a time.
	 */

	server.GET('/samples/divide/:first/:second').onValue(function (path) {
		path
			.when('divide',['request:url_vars'], ['div'], function (produce, input) {
				var first = input[server.CONSTANTS.URL_VARS].first;
				var second = input[server.CONSTANTS.URL_VARS].second;
				if (+second === 0) {
					produce.error(500, 'Divide by 0');
					return;
				}
				produce.finalValue('div', first / second);
			}).
			render(['div'], function(writer, input) {
				writer.setHeader(server.CONSTANTS.HEADER_CONTENT_LENGTH, String(input.div).length);
				writer.setHeader(server.CONSTANTS.HEADER_CONTENT_TYPE, 'text/html');
				writer.writePartial(input.div);
				writer.done();
			});
	});
}

module.exports = createRoute;