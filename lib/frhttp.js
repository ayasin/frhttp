'use strict';
var Bacon = require('baconjs'),
	_ = require('lodash'),
	RouteHandler = require('./routeHandler.js'),
	HTTP = require('http');

function createFRHttp() {
	var VARIABLE_TAG = ' VARIABLE';
	var ROUTE_ENDPOINT_TAG = ' ROUTE_ENDPOINT';
	var ERROR_404 = ' 404';

	function makeCandidatePartsStream(candidate) {
		return (candidate).filter(function (path) {
			return (typeof path === 'string');
		}).map(function (path) {
			return path.split('/');
		});
	}

	// TODO : Make this work with a * in the candidate
	function makeRouteGraph(candidateStream) {
		var baseGraph = {};
		baseGraph[ERROR_404] = RouteHandler.makeRouteHandler([]);
		baseGraph[ERROR_404].process.on({
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
				var next = parts[i].charAt(0) === ':' ? VARIABLE_TAG : parts[i];
				if (typeof walker[next] === 'undefined') {
					walker[next] = {};
				}
				walker = walker[next];
			}
			if (typeof walker[ROUTE_ENDPOINT_TAG] === 'undefined') {
				walker[ROUTE_ENDPOINT_TAG] = RouteHandler.makeRouteHandler(parts);
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
					var next = parts[i].charAt(0) === ':' ? VARIABLE_TAG : parts[i];
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

	function listen(frServer, port) {
		HTTP.createServer(function (req, res) {
			var url = require('url').parse(req.url);
			var method = req.method;
			frServer['TAP_' + method](url).onValue(function (executor) {
				executor.execute(url, req, res, executor.inject);
			})
		}).listen(port);
	}

	var getRouteCandidate =  new Bacon.Bus();
	var getRoutes = makeRouteGraph(getRouteCandidate);

	var postRouteCandidate =  new Bacon.Bus();
	var postRoutes = makeRouteGraph(postRouteCandidate);

	var putRouteCandidate =  new Bacon.Bus();
	var putRoutes = makeRouteGraph(putRouteCandidate);

	var deleteRouteCandidate =  new Bacon.Bus();
	var deleteRoutes = makeRouteGraph(deleteRouteCandidate);

	var frS =  {
		GET : _.curry(verbMakeRouteAt)(getRoutes, getRouteCandidate),
		TAP_GET : _.curry(verbFindRouteAt)(getRoutes),

		POST : _.curry(verbMakeRouteAt)(postRoutes, postRouteCandidate),
		TAP_POST : _.curry(verbFindRouteAt)(postRoutes),

		PUT : _.curry(verbMakeRouteAt)(putRoutes, putRouteCandidate),
		TAP_PUT : _.curry(verbFindRouteAt)(putRoutes),

		DELETE : _.curry(verbMakeRouteAt)(deleteRoutes, deleteRouteCandidate),
		TAP_DELETE : _.curry(verbFindRouteAt)(deleteRoutes),

		CONSTANTS : require('./constants.js')
	};

	frS.listen = _.curry(listen)(frS);

	return frS;
}

module.exports = {
	createServer: createFRHttp
};