'use strict';
var _ = require('lodash');

function createRoute(server) {
	/**
	 * Demonstrates how to emit a value repeatedly from one part of the route and consume it in another.  You could also
	 * do this within one function (since it's just concating the values together), but we're separating it out here for
	 * demo purposes.
	 */

	server.GET('/samples/db.simulation/:items').onValue(function (route) {
		route
			/**
			 * set up the initial values for results and last row.  We're using a 'when' instead of 'inject' because
			 * we want these values to change.  'inject' values are constants.
			 */
			.when('initially', [], ['result'], function(producer) {
				producer.value('result', []);
				producer.done();
			})
			/**
			 * Simulates a database returning 1 row at a time asynchronously (as in next(callback(row)))
			 */
			.when('simulate', [server.CONSTANTS.URL_VARS], ['row'], function(producer, input) {
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
			})
			/**
			 * This is the interesting part. This merges all the results in to a single result.
			 * Note that we avoid getting caught in a loop of 'result updated' by 'triggering on' only row
			 */
			.when('merge',['row', 'result'],['result'],function(producer, input) {
				producer.value('result', input.result.concat([input.row]));
				producer.done();
			},
			// we want to run every time only the row changes
			{ triggerOn: ['row'], takeMany: true })
			.render(['result'], function(writer, input) {
				writer.writeBody(input.result);
			});
	});
}

module.exports  = createRoute;