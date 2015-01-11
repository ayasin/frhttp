'use strict';
var Bacon = require('baconjs');
var _ = require('lodash');

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
	return resolvedVars;
}

function makeBuses(injected, allRequiredVars) {
	var initial =  {};
	initial[READY_STREAM] = new Bacon.Bus();

	return _.reduce(allRequiredVars, _.curry(function (inject, memo, next) {
		if (inject[next]) {
			memo[next] = (new Bacon.Bus()).toProperty().startWith(inject[next]);
		}
		else {
			memo[next] = new Bacon.Bus();
		}
		return memo;
	})(injected),initial);
}

function produceValue(stream, post, name, value) {
	var pushObj = {
		name: name,
		value: value
	};
	if (typeof post === 'function') {
		stream.push(post(pushObj));
	}
	else {
		stream.push(pushObj);
	}
}

function produceError(stream, code, description) {
	stream.error({code: code, description: description});
}

function produceEnd(runCountStream) {
	runCountStream.push(-1);
}

function convertToTemplate(buses, producer, runner, onDef) {
	var producerFns = {
		value: _.curry(produceValue)(producer, onDef.exit),
		error: _.curry(produceError)(producer),
		done: function () {
			produceEnd(runner);
		}
	};
	var initial = {};
	initial[READY_STREAM] =  buses[READY_STREAM];
	var template = _.reduce(onDef.params, function (memo, next) {
		memo[next] = buses[next];
		return memo;
	}, initial);
	var baconTemplate = Bacon.combineTemplate(template).doAction(
		function (runNoif) {
			runNoif.push(1);
		}, runner
	).endOnError();
	baconTemplate.flatMap(function (inVal) {
		if (typeof onDef.enter === 'function') {
			return onDef.enter(inVal);
		}
		else {
			return inVal;
		}
	}).filter(function (val) {
		return typeof val !== 'undefined';
	}).onValue(function (fn, prodObj, val) {
		fn(prodObj, val);
	}, onDef.fn, producerFns);
	return baconTemplate;
}

function makeProcessTemplate(processBlock, buses) {
	var running = new Bacon.Bus();
	var produce = new Bacon.Bus();
	var templates = _.map(processBlock.mapDefinitions.toJS(), _.curry(convertToTemplate)(buses, produce, running));
	produce.onError(function (endBuses, error){
		_.forEach(Object.keys(endBuses), function (key) {
			if (typeof endBuses[key].error === "function") {
				endBuses[key].error(error);
			}
		});
		running.error(error);
	}, buses);
	produce.endOnError().onValue(function (val) {
		if (typeof val === 'object') {
			buses[val.name].push(val.value);
		}
	});

	var busesAsProps = _.reduce(Object.keys(buses), function (memo, key) {
		memo[key] = buses[key].toProperty().startWith(null);
		return memo;
	}, {});

	busesAsProps[PROCESS_FINISHED_SIGNAL] = buses[READY_STREAM].sampledBy(running.endOnError().scan(0, function (memo, action) {
		return memo + action;
	}).skip(1).filter(function (done) {
		return done === 0;
	}).toProperty());
	return Bacon.combineTemplate(busesAsProps);
}

// render phase

function setHeader(headerStream, name, value) {
	headerStream.push({name: name, value: value});
}

function setCookie(cookieStream, name, value) {
	cookieStream.push({name: name, value: value});
}

function writeHeader(responder, headers, cookies) {
	_.forEach(Object.keys(headers), function (key) {
		responder.setHeader(key, String(headers[key]));
	});
	var cookieArray = _.reduce(_.keys(cookies), function (memo, key) {
		memo.push(key + '=' + cookies[key]);
		return memo;
	}, []);
	if (cookieArray.length) {
		responder.setHeader(CONSTANTS.HEADER_COOKIE, cookieArray);
	}
	responder.writeHead(200);
}

function writeBody(headerSetter, writeStream, ender, body) {
	if (typeof body === 'object') {
		body = JSON.stringify(body);
		headerSetter(CONSTANTS.HEADER_CONTENT_TYPE, 'application/json');
	}
	else if (typeof body !== 'string') {
		body = String(body);
		headerSetter(CONSTANTS.HEADER_CONTENT_TYPE, 'text/plain');
	}
	headerSetter(CONSTANTS.HEADER_CONTENT_LENGTH, body.length);
	writeStream.push(body);
	ender();
}

function writePartial(writeStream, partial) {
	if (typeof partial === 'object') {
		writeStream.push(partial);
	}
	else {
		writeStream.push(String(partial));
	}
}

function writeDone(headerStream, cookieStream, writeStream) {
	headerStream.end();
	cookieStream.end();
	writeStream.end();
}

function executeRender(renderBlock, responder, renderVars) {
	var writeStream = new Bacon.Bus();
	var headerStream = new Bacon.Bus();
	var cookieStream = new Bacon.Bus();

	var boundSetHeader = _.curry(setHeader)(headerStream);
	var boundSetCookie = _.curry(setCookie)(cookieStream);
	var boundWriteHeaders = _.once(_.curry(writeHeader)(responder));
	var boundEnd = _.partial(writeDone, headerStream, cookieStream, writeStream);

	var respondObj = {
		setHeader: boundSetHeader,
		setCookie: boundSetCookie,
		writeBody: _.curry(writeBody)(boundSetHeader, writeStream, boundEnd),
		writePartial: _.curry(writePartial)(writeStream),
		done: boundEnd
	};

	var writer = Bacon.combineTemplate({
		headers: headerStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
		cookies: cookieStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
		bodyPart: writeStream
	}).doAction(function (writeReady) {
		boundWriteHeaders(writeReady.headers, writeReady.cookies);
	});

	writer.onValue(function (write) {
		responder.write(write.bodyPart);
	});

	writer.onEnd(function () {
		responder.end();
	});

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
		injected['request:url_vars'] = resolvedPathVars;
		injected['request:request'] = req;
		var processBuses = makeBuses(injected, phaseDefinitions.process.allBuses.toJS());

		var processTemplate = makeProcessTemplate(phaseDefinitions.process, processBuses);
		var render = phaseDefinitions.render.mapDefinitions.toJS()[0];


		processTemplate.onValue(function (renderDef, responder, processed) {
			executeRender(renderDef, responder, processed);

		}, render, res);

		processTemplate.onError(function (responder, error) {
			responder.writeHead(error.code);
			responder.write('Error ' + error.code + ': ' + error.description);
			responder.end();
		}, res);

		processBuses[READY_STREAM].push(1);
	});
}

module.exports = routeExecutor;