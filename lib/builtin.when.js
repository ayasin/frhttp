var CONSTANTS = require('./constants.js');
var Bacon = require('baconjs');
var qs = require('querystring');
var _ = require('lodash');

var WHEN = {};

WHEN.COOKIES = {
	params: [CONSTANTS.REQUEST],
	produces: [CONSTANTS.REQUEST_COOKIES],
	fn: function (producer, input) {
		var rawCookies = input[CONSTANTS.REQUEST].headers.cookie;
		if (!rawCookies || typeof rawCookies !== 'string') {
			producer.value(CONSTANTS.REQUEST_COOKIES, {});
			producer.done();
			return;
		}
		var cookies = _.reduce(rawCookies.split(';'), function (memo, nextCookie) {
			var parts = nextCookie.split('=');
			if (parts.length > 1) {
				memo[parts.shift().trim()] = parts.join('=').trim();
			}
			return memo;
		}, {});
		producer.value(CONSTANTS.REQUEST_COOKIES, cookies);
		producer.done();
	}
};

WHEN.HEADERS = {
	params: [CONSTANTS.REQUEST],
	produces: [CONSTANTS.REQUEST_HEADERS],
	fn: function (producer, input) {
		producer.value(CONSTANTS.REQUEST_HEADERS, input[CONSTANTS.REQUEST].headers);
		producer.done();
	}
}

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

WHEN.QUERY_STRING = {
	params: [CONSTANTS.URL_DETAILS],
	produces: [CONSTANTS.QUERY_VARS],
	fn : function(producer, input) {
		var query = input[CONSTANTS.URL_DETAILS].query;
		if (query && query.length) {
			producer.value(CONSTANTS.QUERY_VARS, qs.parse(query));
		}
		else {
			producer.value(CONSTANTS.QUERY_VARS, {});
		}
		producer.done();
	}
};

module.exports = WHEN;