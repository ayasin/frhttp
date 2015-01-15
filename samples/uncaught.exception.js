'use strict';

function createRoute(server) {
	/**
	 * Demonstrates what happens when a function has an uncaught exception.  HINT: it doesn't crash the server and
	 * you get a very helpful message on the console
	 */

	server.GET('/samples/uncaught').onValue(function (path) {
		path.inject({
			demo: 'a value'
		}).when({
			name: 'Crashes On Purpose',
			params: ['demo'],
			fn: function(produce, input) {
				input.crashNow(); // oops input doesn't have a crashNow function.
				produce.done();
			}
		}).render({
			params: [],
			fn: function (writer) {
				writer.writeBody('Never going to get here...!');
			}
		})
	});
}

module.exports = createRoute;