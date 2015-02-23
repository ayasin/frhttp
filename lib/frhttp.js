'use strict';
var Bacon = require('baconjs'),
	_ = require('lodash'),
	URLParser = require('url').parse,
	RouteDescriptor = require('./routeDescriptor.js'),
	HTTP = require('http'),
	WHEN = require('./builtin.when'),

	VARIABLE_TAG = ' VARIABLE',
	ROUTE_ENDPOINT_TAG = ' ROUTE_ENDPOINT',
	WILDCARD_TAG = ' WILDCARD',
	ERROR_404 = ' 404';

function makeCandidatePartsStream(candidate) {
	return (candidate).filter(function (path) {
		return (typeof path === 'string');
	}).map(function (path) {
		return path.split('/');
	});
}

function convertToRoutableEntry(entry) {
	var firstChar = entry.charAt(0);
	if (firstChar === ':') {
		return VARIABLE_TAG;
	}
	else if (firstChar === '*') {
		return WILDCARD_TAG;
	}
	return entry;
}

function makeRouteGraph(candidateStream) {
	var baseGraph = {};
	baseGraph[ERROR_404] = RouteDescriptor.makeRouteDescriptor([]);
	baseGraph[ERROR_404].when({
		params: [],
		fn: function (producer) {
			producer.error(404, 'Not found');
		}
	});
	return makeCandidatePartsStream(candidateStream).scan(baseGraph, function (memo, parts) {
		var root = memo,
			walker = root,
			start = parts[0].length ? 0 : 1;

		for (var i=start; i<parts.length; i++) {
			var next = convertToRoutableEntry(parts[i]);
			if (typeof walker[next] === 'undefined') {
				walker[next] = {};
			}
			walker = walker[next];
		}
		if (typeof walker[ROUTE_ENDPOINT_TAG] === 'undefined') {
			walker[ROUTE_ENDPOINT_TAG] = RouteDescriptor.makeRouteDescriptor(parts);
		}
		return root;
	});
}

function verbFindRouteAt(graph, path) {
	return Bacon.combineTemplate({
		graph: graph,
		path: path.pathname.split('/')
	}).take(1).map(
		function (source) {
			var root = source.graph;
			var walker = root;
			var start = source.path[0].length ? 0 : 1;
			for (var i=start; i < source.path.length; i++) {
				if (walker[source.path[i]]) {
					walker = walker[source.path[i]];
				}
				else if (walker[WILDCARD_TAG]) {
					walker = walker[WILDCARD_TAG];
					break;
				}
				else if (walker[VARIABLE_TAG]) {
					walker = walker[VARIABLE_TAG];
				}
				else {
					return root[ERROR_404];
				}
			}
			return walker[ROUTE_ENDPOINT_TAG];
		}
	);
}

function verbMakeRouteAt(graph, candidate, path) {
	var pathStream =  new Bacon.Bus();
	process.nextTick(function() {
		var partsStream = makeCandidatePartsStream(candidate).take(1);
		Bacon.combineAsArray(partsStream, graph).map(function (inputs) {
			var walker = inputs[1],
				parts = inputs[0],
				start = parts[0].length ? 0 : '1';
			for (var i=start; i<parts.length; i++) {
				var next = convertToRoutableEntry(parts[i]);
				if (typeof walker[next] === 'undefined') {
					return walker[next];
				}
				walker = walker[next];
			}
			return walker;
		}).filter(function (pathHandler) {
			return (typeof pathHandler !== 'undefined');
		}).take(1).onValue(function (pathHandler) {
			pathStream.push(pathHandler[ROUTE_ENDPOINT_TAG]);
		});
		candidate.push(path);
	});
	return pathStream;
}

function runRouteAndRenderInto(frServer, res, method, path, injected, params, fn) {
	var tapMethod = frServer['TAP_' + method];
	if (tapMethod) {
		tapMethod(url).onValue(function (executor) {
			executor.executeIntoRenderer(res, path, _.defaults(injected, executor.inject), params, fn);
		});
	}
}

function runRoute(frServer, req, res) {
	var url = URLParser(req.url);
	var method = req.method;
	var tapMethod = frServer['TAP_' + method];
	if (tapMethod) {
		tapMethod(url).onValue(function (executor) {
			executor.execute(url, req, res, executor.inject);
		});
	}
	else {
		res.end();
	}
}

function listen(frServer, port) {
	var shutdownHook = HTTP.createServer(function (req, res) {
		runRoute(frServer, req, res);
	});
	shutdownHook.listen(port);
	return _.partial(shutdownHook.close);
}

function createFRHttp() {

	var getRouteCandidate =  new Bacon.Bus();
	var getRoutes = makeRouteGraph(getRouteCandidate);

	var postRouteCandidate =  new Bacon.Bus();
	var postRoutes = makeRouteGraph(postRouteCandidate);

	var putRouteCandidate =  new Bacon.Bus();
	var putRoutes = makeRouteGraph(putRouteCandidate);

	var deleteRouteCandidate =  new Bacon.Bus();
	var deleteRoutes = makeRouteGraph(deleteRouteCandidate);

	var optionsRouteCandidate = new Bacon.Bus();
	var optionsRoutes = makeRouteGraph(optionsRouteCandidate);

	var headRouteCandidate = new Bacon.Bus();
	var headRoutes = makeRouteGraph(headRouteCandidate);

	var nonRESTRouteCandidate = new Bacon.Bus();
	var nonRESTRoutes = makeRouteGraph(nonRESTRouteCandidate);

	var frS =  {
		WHEN : WHEN,
		GET : _.curry(verbMakeRouteAt)(getRoutes, getRouteCandidate),
		TAP_GET : _.curry(verbFindRouteAt)(getRoutes),

		POST : _.curry(verbMakeRouteAt)(postRoutes, postRouteCandidate),
		TAP_POST : _.curry(verbFindRouteAt)(postRoutes),

		PUT : _.curry(verbMakeRouteAt)(putRoutes, putRouteCandidate),
		TAP_PUT : _.curry(verbFindRouteAt)(putRoutes),

		DELETE : _.curry(verbMakeRouteAt)(deleteRoutes, deleteRouteCandidate),
		TAP_DELETE : _.curry(verbFindRouteAt)(deleteRoutes),

		OPTIONS : _.curry(verbMakeRouteAt)(optionsRoutes, optionsRouteCandidate),
		TAP_OPTIONS : _.curry(verbFindRouteAt)(optionsRoutes),

		HEAD : _.curry(verbMakeRouteAt)(headRoutes, headRouteCandidate),
		TAP_HEAD : _.curry(verbFindRouteAt)(headRoutes),

		NON_REST : _.curry(verbMakeRouteAt)(nonRESTRoutes, nonRESTRouteCandidate),
		TAP_NON_REST : _.curry(verbFindRouteAt)(nonRESTRoutes),

		CONSTANTS : require('./constants.js')
	};

	frS.listen = _.curry(listen)(frS);
	frS.runRoute = _.curry(runRoute)(frS);
	frS.runRouteWithRender = _.curry(runRouteAndRenderInto)(frS);

	return frS;
}

module.exports = {
	createServer: createFRHttp
};