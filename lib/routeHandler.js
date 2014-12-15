var Bacon = require('baconjs');
var Immutable = require('immutable');

function makeRouteHandler(pathParts) {
	var vars = {};
	for (var i=0; i<pathParts.length; i++) {
		if (pathParts[i].charAt(0) === ':') {
			vars[i] = pathParts[i].slice(1);
		}
	}

	return {
		parts: pathParts,
		variables: vars,
		stream: new Bacon.Bus()
	};
}

function makeRunnable(routeHandler, pathParts) {
	var runnerMap = Immutable.Map(routeHandler).asMutable();
	var resolvedVars = {};
	var keys = Object.keys(routeHandler.variables);
	for (var i = 0; i < keys.length; i++) {
		resolvedVars[routeHandler.variables[keys[i]]] = pathParts[keys[i]];
	}
	runnerMap.set('URLVariables', resolvedVars);
	return runnerMap.asImmutable();
}

module.exports = {
	makeRouteHandler : makeRouteHandler,
	makeRunnable: makeRunnable
};