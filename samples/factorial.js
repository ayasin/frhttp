'use strict';

function createRoute(server) {
	/**
	 * Demonstrates repeatedly calling a function to produce a next value until the final value is produced.  Also
	 * demonstrates filtering/exiting a 'call loop' using the 'enter' function.
	 */

	server.GET('/samples/factorial/:number').onValue(function (route) {
		route.when({
			name: 'setup',
			params: [server.CONSTANTS.URL_VARS],
			produces: ['max', 'total'],
			fn: function(produce, input) {
				produce.value('max', +input[server.CONSTANTS.URL_VARS].number);
				produce.value('total', {count: 1, current: 1});
				produce.done();
			}
		}).when({
			name: 'calculate',
			params: ['max', 'total'],
			produces: ['total'],
			takeMany: true,
			enter: function(input) {
				if (input.total.count > input.max) {
					return undefined;
				}
				return input;
			},
			fn: function(produce, input) {
				var ret = {
					count: input.total.count + 1,
					current: input.total.current * input.total.count
				};
				produce.value('total', ret);
				produce.done();
			}
		}).render(
			{
				params: ['max', 'total'],
				fn: function(writer, input) {
					writer.writeBody(String(input.total.current));
				}
			}
		)
	});
}

module.exports = createRoute;