'use strict';

/**
 * creates a route that multiplies 2 numbers.  This demonstrates the following features:
 *      URL_VARS
 *      enter functions
 *
 * URL_VARS are the parts of the path with the : in front
 * the enter function as demonstrated here allows you to take the input and transform it before it's passed to the
 * function.  In this case we make the variables a little easier to access.
 */

function createRoute(server) {
	server.GET('/samples/multiply/:first/:second').onValue(function (path) {
		path
			.inject({factor: 2})
			.when('multiply', ['request:url_vars', 'factor'], ['mul'], function (produce, input) {
				produce.value('mul', input.first * input.second);
				produce.done();
			}, {
				enter: function (input) {
					return {
						first: input[server.CONSTANTS.URL_VARS].first,
						second: input[server.CONSTANTS.URL_VARS].second
					};
				}
			})
			.render(['mul', 'factor'], function(writer, input) {
				writer.writeBody('factoring in (' + input.factor + '): ' + input.mul);
			});
	});
}

module.exports = createRoute;