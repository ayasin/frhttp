'use strict';
var Bacon = require('baconjs');
var Immutable = require('immutable');
var _ = require('lodash');

function onGrouper(memo, next) {
	//for efficiency we're mutating the memo rather than creating a new one and returning it
	var list = Immutable.fromJS(next.params);
	if (!memo.allBuses.count() && next.params.length) {
		memo.allBuses = Immutable.Set(next.params).asMutable();
	}
	else {
		memo.allBuses.merge(list);
	}
	memo.mapDefinitions.push(next);
	return memo;
}

function flatPush(stream, messages) {
	if (!_.isArray(messages)) {
		return stream.push(messages);
	}
	Bacon.fromArray(messages).map( function (message) {
		stream.push(message);
	}, stream);
}

function makeRouteHandler(pathParts) {
	var vars = {};
	for (var i=0; i<pathParts.length; i++) {
		if (pathParts[i].charAt(0) === ':') {
			vars[i] = pathParts[i].slice(1);
		}
	}

	var processBus = new Bacon.Bus();
	var renderBus = new Bacon.Bus();


	var process = processBus.scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, onGrouper);

	var render = renderBus.take(1).scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, onGrouper);

	function makeProcessPhase() {
		//noinspection JSUnusedGlobalSymbols
		return {
			on: function (def) {
				flatPush(processBus, def);
				return this;
			},
			render: function (def) {
				renderBus.push(def);
			}
		}
	}

	var handler = {
		parts: pathParts,
		variables: vars,
		process: makeProcessPhase()
	};

	handler.execute = _.curry(require('./routeExecutor'))(handler, {process: process, render: render});

	return handler;
}

module.exports = {
	makeRouteHandler : makeRouteHandler
};
