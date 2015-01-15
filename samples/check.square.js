'use strict';

function createRoute(server) {
	/**
	 * Check if something is a square root (in the worst way possible lol).
	 * Demonstrates URL_VARS, producing values used by other functions.
	 *      Note that the order of the functions (except render) doesn't matter and you could just
	 *      as easily have 2 independent functions, or 2 independent and 1 dependent function
	 */

	server.GET('/samples/isSquareRoot/:number/:possibleSqrt').onValue(function (route) {
		route.when({
			name: 'doubleIt',
			params: [server.CONSTANTS.URL_VARS],
			produces: ['sqrtToPow2'],
			fn: function(produce, input) {
				var possibleSqrt = +input[server.CONSTANTS.URL_VARS].possibleSqrt;
				produce.value('sqrtToPow2', possibleSqrt*possibleSqrt);
				produce.done();
			}
		}).when({
			name: 'checkIt',
			params: [server.CONSTANTS.URL_VARS, 'sqrtToPow2'],
			produces: ['passed'],
			fn: function(produce, input) {
				var checkNum = +input[server.CONSTANTS.URL_VARS].number;
				produce.value('passed', input.sqrtToPow2 === +checkNum);
				produce.done();
			}
		}).render({
			params: [server.CONSTANTS.URL_VARS, 'passed'],
			fn: function(writer, input) {
				var num = input[server.CONSTANTS.URL_VARS].number,
					possibleSqrt = input[server.CONSTANTS.URL_VARS].possibleSqrt;
				if (input.passed) {
					writer.writeBody(possibleSqrt + ' is the square root of ' + num);
				}
				else {
					writer.writeBody(possibleSqrt + ' is not the square root of ' + num);
				}
			}
		});
	});
}

module.exports = createRoute;