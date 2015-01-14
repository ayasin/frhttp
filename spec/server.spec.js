var frhttp = require('../lib/frhttp.js');

var child = require('child_process');

describe('Server Test Suite', function () {
	var server;


	it('should create a server.', function (done) {
		server = frhttp.createServer();
		expect(typeof server).toBe('object');
		expect(typeof server.GET).toBe('function');
		done();
	});

	var previousRoute;
	it('should be create a route', function (done) {
		server.GET('/api/tester').onValue(function (route) {
			expect(route).not.toBe(null);
			expect(route.parts.length).toBe(3);
			expect(Object.keys(route.variables).length).toBe(0);
			previousRoute = route;
			done();
		})
	});

	it('should be able to find the same route to add configs', function (done) {
		server.GET('/api/tester').onValue(function (route) {
			expect(previousRoute).toBe(route);
			done();
		})
	});
});

describe('Blackbox server tests', function() {
	var proc;

	it('should spawn a server', function (done) {
		proc = child.spawn('node', ['./spec/server_runner.js']);
		done();
	});


	it('should kill the server', function (done) {
		proc.kill('SIGTERM');
		done();
	})
});