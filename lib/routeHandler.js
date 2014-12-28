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

function resolvePathVariables(routeHandler, pathParts) {
	var resolvedVars = {};
	var keys = Object.keys(routeHandler.variables);
	for (var i = 0; i < keys.length; i++) {
		resolvedVars[routeHandler.variables[keys[i]]] = pathParts[keys[i]];
	}
	return resolvedVars;
}

function attachBus(produced, buses, busName) {
	if (busName.indexOf(':') < busName.length) {
		var prodVal = produced[busName];
		if (typeof prodVal === 'undefined') {
			buses[busName] = new Bacon.Constant(null);
		}
		else {
			buses[busName] = new Bacon.Constant(prodVal);
		}
	}
	else {
		buses[busName] = new Bacon.Bus();
	}
	return buses;
}

function produceValue(production, buses, canProduce, postAction, obj) {
	if (typeof postAction === 'function') {
		obj = postAction(obj);
	}
	_.forOwn(obj, function (key, num) {
		if (!canProduce[key]) {
			console.log('WARNING: a function produced ' + key + ' but ' + key + ' was not declared in produces array.  Ingored.');
			return;
		}
		var bus = buses[key];
		if (bus) {
			bus.push(obj[key]);
		}
	});
	production.push(obj);
}

function produceEnd(production, runCounter) {
	return function () {
		production.end();
		runCounter.push(-1);
	};
}

function produceError(production, code, error) {
	production.push(new Bacon.Error({
		errorCode: code,
		errorDescription: error || ''
	}));
}

function makeResponderFnObject(production, busews, runCounter, postAction) {
	return {
		produce: _.curry(produceValue)(production, buses, postAction),
		done: produceEnd(production, runCounter),
		error: _.curry(produceError)(production)
	};
}

function buildFnProductionStream(runCountStream, buses, productionStreaqm, def) {
	var inputMap = def.mapInput;
	var outputMap = def.mapProduction;

	var template = _.reduce(def.params, function (memo, param) {
		memo[param] = buses[param];
	}, {'default:_noParam' : new Bacon.constant(null)});

	var curriedFn = _.curry(def.fn)(makeResponderFnObject(productionStreaqm, buses, runCountStream, outputMap));

	var fnRunStream = Bacon.combineTemplate(template).map(function(runCountStream, val) {
		runCountStream.push(1);
		return val;
	}, runCountStream).map(function (inputMap, val) {
		if (inputMap) {
			return inputMap(val);
		}
		return val;
	}, inputMap).onValue(function (fn, takeMany, val) {
		fn(val);
		if (!takeMany) {
			return bacon.noMore;
		}
	}, curriedFn, def.repeatable);
}

function executePhase(phaseBlock) {
	var producing = new Bacon.Bus();

	var defs = phaseBlock.phases[phaseBlock.currentPhase];
	var previousProduction = phaseBlock.produced;

	var running = new Bacon.Bus();

	running.scan(0, function (memo, input) {
		return memo + input;
	}).filter(function (val) {
		return val === 0;
	}).onValue(function (r, p) {
		p.end();
		r.end();
	}, running, producing);

	// make bus list
	var phaseBuses = _.reduce(defs.allBuses, _.curry(attachBus)(previousProduction));

	var buildActiveStreams = _.curry(buildFnProductionStream)(running, phaseBuses, producing);

	var activeStreams = _.map(defs, buildActiveStreams);

	var produceWithEnd = producing.endOnError();

	var production = produceWithEnd.map(function (activeStreams, val) {
		if (!val) {
			return null;
		}
		var prefixed = {};
		var keys = Object.keys(val);
		for (var i=0; i<keys.length; i++) {
			prefixed[val.currentPhase + ':' + keys[i]] = val[keys[i]];
		}
		return prefixed;
	}, activeStreams).fold(phaseBlock, function (memo, val) {
		if (val) {
			var keys = Object.keys(val);
			for (var i=0; i<keys.length; i++) {
				memo.produced[keys[i]] = val[keys[i]];
			}
		}
	});

	return production;
}

function executeRoute(routeHandler, path, req, res, phases) {
	var resolvedPathVars = resolvePathVariables(routeHandler, path);
	var produced = {
		'decode:url_vars' : resolvedPathVars,
		'decode:request' : req
	};

	Bacon.combineTemplate({
		auth: phases.auth,
		process: phases.process,
		render: phases.render
	}).take(1).map(function (produced, phases) {
		return {
			phases: phases,
			produced: produced,
			currentPhase: 'auth'
		};
	}, produced).flatMap(function (phaseBlock) {
		return executePhase(phaseBlock);
	}).map(function (phaseBlock) {
		phaseBlock.currentPhase = 'process';
		return phaseBlock;
	}).flatMap(function (phaseBlock) {
		return executePhase(phaseBlock);
	}).map(function (phaseBlock) {
		return phaseBlock.currentPhase = 'render';
	}).flatMap(function (phaseBlock) {
		return executePhase(phaseBlock);
	});
}


function makeRouteHandler(pathParts) {
	var vars = {};
	for (var i=0; i<pathParts.length; i++) {
		if (pathParts[i].charAt(0) === ':') {
			vars[i] = pathParts[i].slice(1);
		}
	}

	var authBus = new Bacon.Bus();
	var processBus = new Bacon.Bus();
	var renderBus = new Bacon.Bus();


	var auth = authBus.scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	},onGrouper);

	var process = processBus.scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, onGrouper);

	var render = renderBus.scan({
		allBuses : Immutable.Set(),
		mapDefinitions: Immutable.List().asMutable()
	}, onGrouper);

	var makeRenderPhase = {
		on : function (def) { flatPush(renderBus, def); return this;}
	};

	var makeProcessPhase = {
		on : function (def) { flatPush(processBus, def); return this;},
		render: makeRenderPhase
	};

	var makeAuthPhase = {
		on : function (def) { flatPush(authBus, def); return this;},
		process : makeProcessPhase,
		render: makeRenderPhase
	};

	return {
		parts: pathParts,
		variables: vars,
		auth : makeAuthPhase,
		process: makeProcessPhase,
		render: makeRenderPhase,
		execute : function (path, req, res) {
			executeRoute(this, path, req, res, {auth: auth, process: process, render: render});
		}
	};
}

module.exports = {
	makeRouteHandler : makeRouteHandler
};
