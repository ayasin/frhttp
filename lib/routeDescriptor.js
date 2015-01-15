'use strict';
var Bacon = require('baconjs');
var Immutable = require('immutable');
var _ = require('lodash');
var CONSTANTS = require('./constants.js');

var defaultWhenDefinition = {
	name: 'unnamed function',
	params: [],
	produces:[],
	enter: null,
	exit: null,
	takeMany: false
};

function whenGrouper(memo, next) {
	//for efficiency we're mutating the memo rather than creating a new one and returning it
	var allFields = next.params.concat(next.produces || []);
	var list = Immutable.fromJS(allFields);
	if (!memo.allBuses.count() && allFields.length) {
		memo.allBuses = Immutable.Set(allFields).asMutable();
	}
	else {
		memo.allBuses.merge(list);
	}
	memo.mapDefinitions.push(next);
	return memo;
}

function flatPush(stream, messages) {
	if (!_.isArray(messages)) {
		return stream.push(_.defaults(messages, defaultWhenDefinition));
	}
	Bacon.fromArray(messages).map( function (message) {
		stream.push(_.defaults(message, defaultWhenDefinition));
	}, stream);
}

function makeRouteDescriptor(pathParts) {
	var vars = {};
	for (var i=0; i<pathParts.length; i++) {
		if (pathParts[i].charAt(0) === ':') {
			vars[i] = pathParts[i].slice(1);
		}
	}

	var processBus = new Bacon.Bus();
	var renderBus = new Bacon.Bus();
	var injectBus = new Bacon.Bus();


	var process = processBus.scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, whenGrouper);

	process.onValue(function () {});

	var render = renderBus.take(1).doAction(function (pb, def) {
		//since any var we send to render must go through production, we need ensure that vars are available for render
		//that have been injected in case no producer asked for them.
		var dummy = {
			params: def.params,
			fn : function (producer) {
				producer.done();
			}
		};
		pb.push(_.defaults(dummy, defaultWhenDefinition));
	}, processBus).scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, whenGrouper);

	renderBus.skip(1).onValue(function () {
			console.log('ERROR: Attempt to register multiple render objects for path /' + pathParts.join('/'));
		}
	);

	render.onValue(function () {});

	var inject = injectBus.scan({}, function(memo, value) {
		_.forEach(Object.keys(value), function (key) {
			memo[key] = value[key];
		});
		return memo;
	});

	inject.onValue(function () {});

	function makeProcessPhase() {
		//noinspection JSUnusedGlobalSymbols
		return {

		}
	}

	var handler = {
		parts: pathParts,
		variables: vars,
		when: function (def) {
			flatPush(processBus, def);
			return this;
		},
		inject: function (value) {
			if (typeof value === 'object') {
				injectBus.push(value);
			}
			return this;
		},
		parseBody: function () {
			this.when({
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
			});
			return this;
		},
		render: function (def) {
			renderBus.push(def);
		}
	};

	handler.execute = _.curry(require('./routeExecutor'))(handler, Bacon.combineTemplate({
		process : process,
		render: render,
		inject: inject
	}));

	return handler;
}

module.exports = {
	makeRouteDescriptor : makeRouteDescriptor
};
