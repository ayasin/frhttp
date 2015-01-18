var CONSTANTS = require('./constants.js');
var Bacon = require('baconjs');

var WHEN = {};

WHEN.BODY = {
	params: [CONSTANTS.REQUEST],
	produces: [CONSTANTS.REQUEST_BODY],
	fn: function (producer, input) {
		var partial = new Bacon.Bus();
		partial.fold('', function(memo, chunk) {
			return memo + String(chunk);
		}).take(1).onValue(function (data) {
			producer.value(CONSTANTS.REQUEST_BODY, data);
			producer.done();
		});

		input[CONSTANTS.REQUEST].on('data', function (chunk) {
			partial.push(chunk);
		});

		input[CONSTANTS.REQUEST].on('end', function () {
			partial.end();
		});
	}
};

module.exports = WHEN;