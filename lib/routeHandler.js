var Bacon = require('baconjs');
var Immutable = require('immutable');
var _ = require('lodash');

/*
	{
		params: ['req', 'dbNames', 'userData'],
		produces: ['success', 'failure'],
		mapProduction: function ()]
		fn: function ()
	}
 */

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

function executePhases(routeHandler, path, req, res, phases) {
	var resolvedPathVars = resolvePathVariables(routeHandler, path);
	/*
	todo:
		build the buses for each required var,
		create a stream for each fn to accept for producers on each phase
		pull that stream through the map fns and then push the data through some combimes
		once done is called go to the next phase until there aren't anymore

		phase fn signature : function (inOpts, requestedObject)

		inOpts: { path, pathVars, req }
	 */
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
		execute : function (path, req, res) {
			executePhases(this, path, req, res, [auth, process, render]);
		}
	};
}

module.exports = {
	makeRouteHandler : makeRouteHandler
};