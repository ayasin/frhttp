'use strict';
var Bacon = require('baconjs');
var _ = require('lodash');
var safeJSONStringify = require('json-stringify-safe');
var Producer = require('./producer.js');
var Writer = require('./writer.js');

var CONSTANTS = require('./constants.js');

var READY_STREAM = 'internal:__ready';
var PROCESS_FINISHED_SIGNAL = 'internal:__process_finished_signal';

// process phase
function resolvePathVariables(routeHandler, pathParts) {
	var resolvedVars = {};
	var keys = Object.keys(routeHandler.variables);
	for (var i = 0; i < keys.length; i++) {
		resolvedVars[routeHandler.variables[keys[i]]] = pathParts[keys[i]];
	}
	if (routeHandler.hasWildcard) {
		resolvedVars[CONSTANTS.URL_VAR_WILDCARD] = pathParts.slice(routeHandler.wildCardAt).join('/');
	}
	return resolvedVars;
}

function makeBuses(injected, allRequiredVars) {
	var initial =  {};
	initial[READY_STREAM] = new Bacon.Bus();
	initial[CONSTANTS.DATA_ARRIVED] = new Bacon.Bus();
	initial[CONSTANTS.DATA_FINISHED] = new Bacon.Bus();

	return _.reduce(allRequiredVars, _.curry(function (inject, memo, next) {
		if (inject[next]) {
			memo[next] = Bacon.constant(inject[next]);
		}
		else {
			memo[next] = new Bacon.Bus();
		}
		return memo;
	})(injected),initial);
}

function convertToTemplate(buses, runner, mainProducer, onDef) {
	//var producerFns = Producer.makeProducer(onDef, mainProducer, runner);
	var initial = {};
	initial[READY_STREAM] =  buses[READY_STREAM];
	var sampler = undefined;
	if (onDef.triggerOn && onDef.triggerOn.length) {
		var sampleTemplateDef = _.reduce(onDef.triggerOn, function (memo, next) {
			memo[next] = buses[next];
			return memo;
		}, {});
		sampler = Bacon.combineTemplate(sampleTemplateDef);
	}
	var template = _.reduce(onDef.params, function (memo, next) {
		if (sampler) {
			memo[next] = buses[next].sampledBy(sampler);
		}
		else {
			memo[next] = buses[next];
		}
		return memo;
	}, initial);
	var baconTemplate = Bacon.combineTemplate(template).doAction(
		function (runNoif) {
			runNoif.push(1);
		}, runner
	).endOnError();
	baconTemplate.map(function (runCounter, mainProd, val) {
		var subProducer = new Bacon.Bus();
		mainProd.plug(subProducer);
		subProducer.onEnd(function() {
			runCounter.push(-1);
		});
		subProducer.onError(function(err) {
			mainProducer.error(err);
			runCounter.push(-1);
			subProducer.end();
		});
		return {
			val: val,
			prodObj: Producer.makeProducer(onDef, subProducer)
		};
	}, runner, mainProducer).onValue(function (fn, name, enter, takeMany, template) {
		var prodObj = template.prodObj;
		var val = template.val;
		runner = function () {
			try {
				fn(prodObj, val);
			}
			catch (err) {
				console.log('ERROR: function (' + name + ') threw an exception (' + err +  ') on input: \r\n' + safeJSONStringify(val, null, 2));
				console.log('Stack Trace: ' + err.stack);
				prodObj.error(500, err);
			}
		};
		try {
			if (typeof onDef.enter === 'function') {
				val = onDef.enter(val);
			}
			if (val) {
				process.nextTick(function () {
					runner();
				});
			}
			else {
				prodObj.done();
			}
		}
		catch (err) {
			console.log('ERROR: enter transform for function (' + name +
						') threw an exception (' + err + ') on input: \r\n' +
						safeJSONStringify(val, null, 2));
			console.log('Stack Trace: ' + err.stack);
			prodObj.error(500, err);
		}
		if (!takeMany) {
			return Bacon.noMore;
		}
	}, onDef.fn, onDef.name, onDef.enter, onDef.takeMany);
}

function makeProcessTemplate(processBlock, buses) {
	var running = new Bacon.Bus();
	var produce = new Bacon.Bus();
	_.forEach(processBlock.mapDefinitions.toJS(), _.curry(convertToTemplate)(buses, running, produce));
	produce.onError(function (endBuses, error){
		_.forEach(Object.keys(endBuses), function (key) {
			if (typeof endBuses[key].error === "function") {
				endBuses[key].end();//.error(error);
			}
		});
		running.error(error);
	}, buses);
	produce.endOnError().onValue(function (val) {
		if (typeof val === 'object') {
			buses[val.name].push(val.value);
		}
	});
	produce.endOnError().onEnd(function (endBuses) {
		_.forEach(Object.keys(endBuses), function (key) {
			if (typeof endBuses[key].end === "function") {
				endBuses[key].end();
			}
		});
		running.end();
	}, buses);

	var busesAsProps = _.reduce(Object.keys(buses), function (memo, key) {
		memo[key] = buses[key].toProperty().startWith(null);
		return memo;
	}, {});

	busesAsProps[PROCESS_FINISHED_SIGNAL] = buses[READY_STREAM].sampledBy(running.endOnError().scan(0, function (memo, action) {
		return memo + action;
	}).skip(1).filter(function (done) {
		return done === 0;
	}).doAction(function () {
		produce.end();
	}).toProperty());

	return Bacon.combineTemplate(busesAsProps);
}

// render phase
function executeRender(renderBlock, responder, renderVars) {
	var respondObj = Writer.makeWriter(responder);

	var initial = {};
	var template = _.reduce(renderBlock.params, function (memo, next) {
		memo[next] = renderVars[next];
		return memo;
	}, initial);
	Bacon.combineTemplate(template).onValue(function (fn, respObj, val) {
		fn(respObj, val);
	}, renderBlock.fn, respondObj);
}

function routeExecutor(handler, phases, path, req, res, inject) {
	phases.onValue(function (phaseDefinitions) {
		var resolvedPathVars = resolvePathVariables(handler, path.pathname.split('/'));
		inject = _.defaults(inject || {}, phaseDefinitions.inject || {});
		var injected = _.cloneDeep(inject);
		injected[CONSTANTS.URL_VARS] = resolvedPathVars;
		injected[CONSTANTS.URL_DETAILS] = path;
		injected[CONSTANTS.REQUEST] = req;
		var processBuses = makeBuses(injected, phaseDefinitions.process.allBuses.toJS());

		var processTemplate = makeProcessTemplate(phaseDefinitions.process, processBuses);
		var render = phaseDefinitions.render.mapDefinitions.toJS()[0];


		processTemplate.onValue(function (renderDef, responder, processed) {
			executeRender(renderDef, responder, processed);

		}, render, res);

		processTemplate.onError(function (h, responder, error) {
			if (typeof h.customError === 'function') {
				h.customError(Writer.makeWriter(responder), error.code, error.description);
			}
			else {
				responder.writeHead(error.code);
				responder.write('Error ' + error.code + ': ' + error.description);
				responder.end();
			}
		}, handler, res);

		processBuses[READY_STREAM].push(1);
	});
}

module.exports = routeExecutor;