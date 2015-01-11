'use strict';
var Bacon = require('baconjs');
//var Immutable = require('immutable');
var _ = require('lodash');

var HEADER_STREAM = 'internal:__headerStream';
var COOKIE_STREAM = 'internal:__cookieStream';
var READY_STREAM = 'internal:__ready';

var SCANNED_HEADERS = '__HEADERS';
var SCANNED_COOKIES = '__COOKIES';

function resolvePathVariables(routeHandler, pathParts) {
	var resolvedVars = {};
	var keys = Object.keys(routeHandler.variables);
	for (var i = 0; i < keys.length; i++) {
		resolvedVars[routeHandler.variables[keys[i]]] = pathParts[keys[i]];
	}
	return resolvedVars;
}

function makeBuses(injected, allRequiredVars) {
	var initial =  {
		'internal:__ready': new Bacon.Bus()
	};
	initial[HEADER_STREAM] = new Bacon.Bus();
	initial[COOKIE_STREAM] = new Bacon.Bus();

	initial[SCANNED_HEADERS] = initial[HEADER_STREAM].scan({}, function (memo, value) {
		memo[value.key] = value.val;
		return memo;
	});
	initial[SCANNED_COOKIES] = initial[COOKIE_STREAM].scan({}, function (memo, value) {
		memo[value.key] = value.val;
		return memo;
	});

	return _.reduce(allRequiredVars.toJS(), _.curry(function (inject, memo, next) {
		if (inject[next]) {
			memo[next] = Bacon.constant(inject[next]);
		}
		else {
			memo[next] = new Bacon.Bus();
		}
	})(injected),initial);
}

function produceValue(stream, post, name, value) {
	var pushObj = {};
	pushObj[name] = value;
	if (typeof post === 'function') {
		stream.push(post(pushObj));
	}
	else {
		stream.push(pushObj);
	}
}

function produceError(stream, code, description) {
	stream.push(new Bacon.Error({code: code, description: description}));
}

function produceEnd(runCountStream) {
	runCountStream.push(-1);
}

function convertToTemplate(buses, producer, runner, onDef) {
	var producerFns = {
		produce: _.curry(produceValue)(producer, onDef.exit),
		error: _.curry(produceError)(producer),
		end: function () {
			produceEnd(runner);
		}
	};
	var initial = {};
	initial[READY_STREAM] =  buses[READY_STREAM];
	var template = _.reduce(onDef.params, function (memo, next) {
		memo[next] = buses[next];
	}, initial);
	var baconTemplate = Bacon.combineTemplate(template).doAction(
		function (runNoif) {
			runNoif.push(1);
		}, runner
	).endOnError();
	baconTemplate.flatMap(function (inVal) {
		if (typeof onDef.entry === 'function') {
			return onDef(inVal);
		}
		else {
			return inVal;
		}
	}).onValue(function (fn, prodObj, val) { fn(prodObj, val); }, onDef.fn, producerFns);
	return baconTemplate;
}

function makeProcessTemplate(processBlock, producer, injected) {
	var buses = makeBuses(injected, processBlock.allBuses);
	var running = new Bacon.Bus();
	var produce = new Bacon.Bus();
	var templates = _.map(processBlock.mapDefinitions, _.curry(convertToTemplate)(buses, running, produce));
	produce.onError(function (endBuses, error){
		_.forEach(Object.keys(endBuses), function (key) {
			endBuses[key].error(error);
		});
		running.error(error);
	}, buses);

	return Bacon.combineTemplate({
		produced: _.map(buses, function (busToConvert) { return busToConvert.toProperty(); }),
		run: buses[READY_STREAM],
		templates: templates,
		finished: Bacon.sampledBy(running.endOnError().scan(0, function (memo, action) {
			return memo + action;
		}).filter(function (done) {
			return done === 0;
		}))
	}).endOnError();
}

function executeRender(renderBlock, responder, renderVars) {
	var initial = {};
	initial[READY_STREAM] =  new Bacon.Bus();
	var template = _.reduce(renderBlock.params, function (memo, next) {
		memo[next] = renderVars[next];
	}, initial);

	var respondObj = {
		write: function (data) {
			responder.write(data);
		},
		done: function () {
			responder.end();
		}
	};

	template.onValue(function (fn, respObj, val) {
		fn(respObj, val);
	}, renderBlock.fn, respondObj);
}

function routeExecutor(handler, phaseDefinitions, path, req, res, inject) {
	var resolvedPathVars = resolvePathVariables(handler, path);
	inject = inject || {};
	var injected = _.cloneDeep(inject);
	injected['request:url_vars'] = resolvedPathVars;
	injected['request:request'] = req;
	var processBuses = makeBuses(injected, phaseDefinitions.process.allBuses);

	var producer = new Bacon.Bus();
	var processTemplate = makeProcessTemplate(phaseDefinitions.process, producer, processBuses);

	processTemplate.onValue(function (responder, processed) {
		_.forEach(Object.keys(headers), function (key) {
			responder.setHeader(key, headers[key]);
		});
		executeRender(renderDef, responder, processed);
	}, phaseDefinitions.render, res);

	processTemplate.onError(function (responder, error) {
		responder.writeHead(error.code);
		responder.write(error.description);
		responder.end();
	}, res);
}

module.exports = routeExecutor;