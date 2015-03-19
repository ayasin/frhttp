'use strict';

function createRoute(server) {

	/**
	 * redirect.
	*/

  server.GET('/samples/redirect/target').onValue(function (route) {
    route.render([], function (writer) {
			writer.writeBody('you were sent here by /samples/redirect');
		});
  });

	server.GET('/samples/redirect').onValue(function (route) {
		route.render([], function (writer) {
			writer.redirect('/samples/redirect/target');
		});
	});
}

module.exports = createRoute;
