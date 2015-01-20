'use strict';
var _ = require('lodash');

function createRoute(server) {
	/**
	 * Demonstrates how to emit a value repeatedly from one part of the route and consume it in another.  You could also
	 * do this within one function (since it's just concating the values together), but we're separating it out here for
	 * demo purposes.
	 */

	server.GET('/samples/querySimulator/:items').onValue(function (route) {
		route.when({
			/**
			 * set up the initial values for results and last row.  We're using a 'when' instead of 'inject' because
			 * we want these values to change.  'inject' values are constants.
			 */
			name: 'initially',
			produces: ['result'],
			fn: function(producer) {
				producer.value('result', []);
				producer.done();
			}
		}).when({
			/**
			 * Simulates a database returning 1 row at a time asynchronously (as in next(callback(row)))
			 */
			name: 'simulate',
			params: [server.CONSTANTS.URL_VARS],
			produces: ['row'],
			fn: function(producer, input) {
				var maxIterations = +input[server.CONSTANTS.URL_VARS].items || 10;
				for (var i=0; i < maxIterations+1; i++) {
					setTimeout(_.partial(function (iteration) {
						if (iteration < maxIterations) {
							producer.value('row', iteration);
						}
						else {
							producer.done();
						}
					}, i), i * 10);
				}
			}
		}).when({
			/**
			 * This is the interesting part. This merges all the results in to a single result.
			 * Note that we 'skip duplicates' using the enter function.
			 */
			name: 'merge',
			params: ['row', 'result'],
			triggerOn: ['row'],
			produces: ['result'],
			takeMany: true,
			/*enter: function (input) {
				// if the last row and the row are the same it means we just produced a result and don't need to
				// do anything more.  Returning undefined ends further execution until something else changes.
				if (input.last_row === input.row) {
					return undefined;
				}
				return input;
			},*/
			fn: function(producer, input) {
				// produce the last row first so we prevent this from being called when we produce a new result
				//producer.value('last_row', input.row);
				producer.value('result', input.result.concat([input.row]));
				producer.done();
			}
		}).render({
			params: ['result'],
			fn: function(writer, input) {
				writer.writeBody(input.result);
			}
		});
	});
}

module.exports  = createRoute;