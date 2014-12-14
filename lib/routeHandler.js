var Bacon = require('baconjs');

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

module.exports = {
	makeRouteHandler : makeRouteHandler
};