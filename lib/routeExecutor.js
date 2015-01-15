(function(){
	
	'use strict';
	var Bacon = require('baconjs');
	var _ = require('lodash');
	var safeJSONStringify = require('json-stringify-safe');

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

	function produceValue(stream, fnName, canMake, post, name, value) {
		if (_.indexOf(canMake, name) === -1) {
			console.log('ERROR: Function (name: ' + fnName + ') attempted to produce "' + name + '" but only declared ' + JSON.stringify(canMake) +
			'.  Ignoring.');
			return;
		}
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
			value: _.curry(produceValue)(producer, onDef.name, onDef.produces, onDef.exit),
			error: _.curry(produceError)(producer),
			done: _.partial(produceEnd, runner)
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
		}).onValue(function (fn, name, sync, takeMany, prodObj, val) {
			if (typeof val !== 'undefined') {
				runner = function () {
					try {
						fn(prodObj, val);
					}
					catch (err) {
						console.log('ERROR: function (' + name + ') threw an exception (' + err + ') on input: ' + safeJSONStringify(val, null, 2));
						prodObj.error(500, err);
					}
				};
				if (sync) {
					runner();
				}
				else {
					process.nextTick(function () {
						runner();
					});
				}

				if (!takeMany) {
					return Bacon.noMore;
				}
			}
			else {
				prodObj.done();

			}
		}, onDef.fn, onDef.name, onDef.sync, onDef.takeMany, producerFns);
	}

	function makeProcessTemplate(processBlock, buses) {
		var running = new Bacon.Bus();
		var produce = new Bacon.Bus();
		_.forEach(processBlock.mapDefinitions.toJS(), _.curry(convertToTemplate)(buses, produce, running));
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

	function setHeader(headerStream, name, value) {
		headerStream.push({name: name, value: value});
	}

	function setCookie(cookieStream, name, value) {
		cookieStream.push({name: name, value: value});
	}

	function setStatus(statusStream, code) {
		statusStream.push(code);
	}

	function writeHeader(responder, status, headers, cookies) {
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
		responder.writeHead(status);
	}

	function writeBody(headerSetter, writeStream, ender, body) {
		if (typeof body === 'object') {
			body = safeJSONStringify(body, null, 1, function(k,v){});
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

	function writeDone(headerStream, statusStream, cookieStream, writeStream) {
		headerStream.end();
		statusStream.end();
		cookieStream.end();
		writeStream.end();
	}

	function executeRender(renderBlock, responder, renderVars) {
		var writeStream = new Bacon.Bus();
		var headerStream = new Bacon.Bus();
		var cookieStream = new Bacon.Bus();
		var statusStream = new Bacon.Bus();

		var boundSetHeader = _.curry(setHeader)(headerStream);
		var boundSetCookie = _.curry(setCookie)(cookieStream);
		var boundStatus = _.curry(setStatus)(statusStream);
		var boundWriteHeaders = _.once(_.curry(writeHeader)(responder));
		var boundEnd = _.partial(writeDone, headerStream, statusStream, cookieStream, writeStream);

		var respondObj = {
			setHeader: boundSetHeader,
			setCookie: boundSetCookie,
			setStatus: boundStatus,
			writeBody: _.curry(writeBody)(boundSetHeader, writeStream, boundEnd),
			writePartial: _.curry(writePartial)(writeStream),
			done: boundEnd
		};

		var writer = Bacon.combineTemplate({
			headers: headerStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
			cookies: cookieStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
			status: statusStream.toProperty().startWith(200),
			bodyPart: writeStream
		}).doAction(function (writeReady) {
			boundWriteHeaders(writeReady.status, writeReady.headers, writeReady.cookies);
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
			injected[CONSTANTS.URL_VARS] = resolvedPathVars;
			injected[CONSTANTS.REQUEST] = req;
			var processBuses = makeBuses(injected, phaseDefinitions.process.allBuses.toJS());
			processBuses[READY_STREAM].take(1).onValue(function () {
				req.on('data', function (chunk) {
					processBuses[CONSTANTS.DATA_ARRIVED].push(chunk);
				});
				req.on('end', function () {
					processBuses[CONSTANTS.DATA_FINISHED].push(1);
				});
			});

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

})(); //end iife