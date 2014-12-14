var Bacon = require('baconjs'),
	_ = require('lodash'),
	RouteHandler = require('./routeHandler.js');

function createFRHttp() {
	var VARIABLE_TAG = ' VARIABLE';
	var ROUTE_ENDPOINT_TAG = ' ROUTE_ENDPOINT';

	function makeCandidatePartsStream(candidate) {
		return (candidate).filter(function (path) {
			return (typeof path === 'string');
		}).map(function (path) {
			return path.split('/');
		});
	}

	function makeRouteGraph(candidateStream) {
		return makeCandidatePartsStream(candidateStream).scan({}, function (memo, parts) {
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

	function verbAt(graph, candidate, path) {
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
		GET : _.curry(verbAt)(getRoutes)(getRouteCandidate)
	};
}

server = createFRHttp();

module.exports = {
	createServer: createFRHttp
};