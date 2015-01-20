'use strict';
var Bacon = require('baconjs');

var _ = require('lodash');
var bus = new Bacon.Bus();
bus.log();

function createRoute(server) {

	/**
	 * Demonstrates injecting a value or function into a route handler.  Also demonstates HOW TO PROPERLY INJECT A BACON
	 * OBSERVABLE.  Due to internal details of how the frhttp server works, you can't just directly inject a bacon observable.
	 * YOU CAN inject any other kind of object/function.
	 */

	server.GET('/samples/inject').onValue(function (route) {
		route.inject({theBus : function () {return bus;}}).when({
			name: 'makes another bus',
			params: [],
			produces: ['anotherBus'],
			fn : function(producer) {
				producer.value('anotherBus', new Bacon.Bus());
				return producer.done();
			}
		}).render({
			params: ['theBus'],
			fn: function (writer, input) {
				//input.theBus().push(12);
				writer.writeBody('theBus() === bus: ' + (input.theBus() === bus));
			}
		});
	});
}

module.exports = createRoute;