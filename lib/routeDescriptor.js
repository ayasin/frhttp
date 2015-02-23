'use strict';
var Bacon = require('baconjs');
var Immutable = require('immutable');
var _ = require('lodash');
var CONSTANTS = require('./constants.js');

var defaultWhenDefinition = {
	name: 'unnamed function',
	params: [],
	produces:[],
	triggerOn: [],
	enter: null,
	exit: null,
	takeMany: false
};

function whenGrouper(memo, next) {
	//for efficiency we're mutating the memo rather than creating a new one and returning it
	var allFields = next.params.concat(next.produces || []).concat(next.triggerOn || []);
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
	Bacon.fromArray(_.flattenDeep(messages)).onValue( function (stream, message) {
		stream.push(_.defaults(message, defaultWhenDefinition));
	}, stream);
}

function makeRouteDescriptor(pathParts) {
	var vars = {};
	var wildCardAt = undefined;
	for (var i=0; i<pathParts.length; i++) {
		var firstChar = pathParts[i].charAt(0);
		if (firstChar === ':') {
			vars[i] = pathParts[i].slice(1);
		}
		else if (firstChar === '*') {
			wildCardAt = i;
			break;
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
		_.forOwn(Object.keys(value), function (key) {
			memo[key] = value[key];
		});
		return memo;
	});

	inject.onValue(function () {});

	function makeProcessPhase() {
		//noinspection JSUnusedGlobalSymbols
		return {

		};
	}

	var handler = {
		parts: pathParts,
		variables: vars,
		hasWildcard: (wildCardAt !== undefined),
		wildCardAt: wildCardAt,
		customError: null,
		addWhen: function (name, inputParams, canOutput, fn, advancedOpts) {
			if (_.isNull(inputParams) || _.isUndefined(inputParams)) {
				inputParams = [];
			}
			else if (_.isString(inputParams)) {
				inputParams = [inputParams];
			}
			if (_.isNull(canOutput) || _.isUndefined(canOutput)) {
				canOutput = [];
			}
			else if (_.isString(canOutput)) {
				canOutput = [canOutput];
			}
			flatPush(processBus, _.defaults({
				name: name || 'unnamed function',
				params: inputParams,
				produces: canOutput,
				fn: fn
			}, (advancedOpts || {})));
			return this;
		},
		when: function (def) {
			if (!_.isArray(def) && (_.isNull(def) || _.isString(def))) {
				return this.addWhen.apply(this, arguments);
			}
			flatPush(processBus, def);
			return this;
		},
		inject: function (value) {
			if (typeof value === 'object') {
				injectBus.push(value);
			}
			else {
				throw (new Error('Expected inject to be an object, but you passed a ' + typeof value));
			}
			return this;
		},
		addRender: function (inputParams, renderFn, advancedOpts) {
			if (_.isNull(inputParams) || _.isUndefined(inputParams)) {
				inputParams = [];
			}
			else if (_.isString(inputParams)) {
				inputParams = [inputParams];
			}
			renderBus.push(_.defaults({
				params: inputParams,
				fn: renderFn
			}, (advancedOpts || {})));
		},
		render: function (def) {
			if (_.isNull(def) || _.isArray(def)) {
				return this.addRender.apply(this, arguments);
			}
			renderBus.push(def);
		}
	};

	handler.execute = _.curry(require('./routeExecutor').httpExecutor)(handler, Bacon.combineTemplate({
		process : process,
		render: render,
		inject: inject
	}));

	handler.executeIntoRenderer = _.curry(require('./routeExecutor').customRenderExecutor)(handler, Bacon.combineTemplate({
		process : process,
		inject: inject
	}));

	handler.setCustomErrorHandler = _.curry(function (h, errFn) {
		h.customError = errFn;
		return h;
	})(handler);

	return handler;
}

module.exports = {
	makeRouteDescriptor : makeRouteDescriptor
};
