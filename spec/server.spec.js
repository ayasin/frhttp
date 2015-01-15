var frhttp = require('../lib/frhttp.js');
var frisby = require('frisby');
var child = require('child_process');

describe('Server Tests', function () {
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

describe('Route descriptor and executor tests', function() {
	var runningServer;

	it('should spawn a server', function (done) {
		runningServer = child.spawn('node', ['./spec/server_runner.js']);
		setTimeout(function () {done();}, 1000);
	});

	frisby.create('basic hello')
		.get('http://localhost:8008/test/hello').expectStatus(200).expectBodyContains('hello').toss();

	frisby.create('url variables')
		.get('http://localhost:8008/test/divide/4/2').expectStatus(200).expectBodyContains('2').toss();

	frisby.create('error production')
		.get('http://localhost:8008/test/divide/4/0').expectStatus(500).expectBodyContains('Divide by 0').toss();

	frisby.create('inject constant')
		.get('http://localhost:8008/test/multiply/2/2').expectStatus(200).expectBodyContains('factoring in (2): 8').toss();

	frisby.create('post')
		.post('http://localhost:8008/test/replay', {a: 15}, {json: true})
		.expectStatus(200).expectBodyContains('You sent {"a":15}').toss();

	frisby.create('enter filter and recursive production')
		.get('http://localhost:8008/test/factorial/4').expectStatus(200).expectBodyContains('24').toss();

	frisby.create('exit filter')
		.get('http://localhost:8008/test/makeFactorialNegative/4').expectStatus(200).expectBodyContains('-24').toss();

	it('should kill the server', function (done) {
		runningServer.kill('SIGTERM');
		done();
	})
});