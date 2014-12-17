var Bacon = require('baconjs'),
	_ = require('lodash'),
	RouteHandler = require('./routeHandler.js');

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

	function makeRouteGraph(candidateStream) {
		var baseGraph = {};
		baseGraph[ERROR_404] = RouteHandler.makeRouteHandler([]);
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
			path: path.split('/')
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

	var getRouteCandidate =  new Bacon.Bus();
	var getRoutes = makeRouteGraph(getRouteCandidate);

	return {
		GET : _.curry(verbMakeRouteAt)(getRoutes)(getRouteCandidate),
		TAP_GET : _.curry(verbFindRouteAt)(getRoutes)
	};
}

server = createFRHttp();

module.exports = {
	createServer: createFRHttp
};