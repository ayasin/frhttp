'use strict';

function createRoute(server) {
	/**
	 * Demonstrates what happens when a function has an uncaught exception.  HINT: it doesn't crash the server and
	 * you get a very helpful message on the console
	 */

	server.GET('/samples/uncaught.exception').onValue(function (path) {
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

	server.GET('/samples/uncaught.exception/custom.handler').onValue(function (path) {
		path.inject({
			demo: 'a value'
		}).setCustomErrorHandler(function (writer, code, description) {
			writer.setStatus(code);
			writer.writeBody(code + ' : An error occurred, but I intercepted it and wrote this to the client');
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

	server.GET('/samples/uncaught.exception/enter').onValue(function (path) {
		path.inject({
			demo: 'a value'
		}).when({
			name: 'Crashes On Purpose',
			params: ['demo'],
			enter: function (input) {
				input.crashNow(); // oops input doesn't have a crashNow function.
			},
			fn: function(produce) {
				produce.done();
			}
		}).render({
			params: [],
			fn: function (writer) {
				writer.writeBody('Never going to get here...!');
			}
		})
	});

	server.GET('/samples/uncaught.exception/exit').onValue(function (path) {
		path.inject({
			demo: 'a value'
		}).when({
			name: 'Crashes On Purpose',
			params: ['demo'],
			produces: ['a', 'b'],
			exit: function (input) {
				input.crashNow(); // oops input doesn't have a crashNow function.
			},
			fn: function(produce) {
				produce.value('a', 5);
				produce.value('b', 5);
				produce.done();
			}
		}).render({
			params: ['a'],
			fn: function (writer) {
				writer.writeBody('Never going to get here...!');
			}
		})
	});


}

module.exports = createRoute;