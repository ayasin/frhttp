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

	var errorOnBuiltInResponder = false;

	it('should be able to create a non-rest route', function (done) {
		server.NON_REST('/api/tester/customRender').onValue(function (route) {
			route.when('custom render test', ['msg'], ['rmsg'], function (produce, input) {
				produce.value('rmsg', input.msg.split('').reverse().join(''));
				produce.done();
			}).render(['rmsg'], function (writer, input) {
				if (errorOnBuiltInResponder) {
					expect(1).toBe(2);
				}
				writer.checkVal('attached renderer says ' + input.rmsg);
			});
			done();
		});
	});

	it('should be able to execute a non-rest route with a custom renderer and the route responder', function (done) {
		var responder = {
			error : function () {
				expect(1).toBe(0);
			},
			checkVal : function (data) {
				expect(data).toBe('attached renderer says ti tset');
				done();
			}
		};
		server.runRouteWithRender(responder, 'NON_REST', '/api/tester/customRender', {msg: 'test it'});
	});

	it('should be able to execute a non-rest route with a custom renderer and custom responder', function (done) {
		var responder = {
			error : function () {
				expect(1).toBe(0);
			},
			checkVal : function (data) {
				expect(data).toBe('custom renderer says ti tset');
				done();
			}
		};
		server.runRouteWithRender(responder, 'NON_REST', '/api/tester/customRender', {msg: 'test it'}, ['rmsg'], function (writer, input) {
			writer.checkVal('custom renderer says ' + input.rmsg);
		});
	});

	it('should be able to execute a non-rest route without a responder', function (done) {
		errorOnBuiltInResponder = true;
		server.runRouteWithRender(null, 'NON_REST', '/api/tester/customRender', {msg: 'test it'});
		done();
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

	frisby.create('wildcard in route')
		.get('http://localhost:8008/test/wild/*/next/part/of/path').expectStatus(200).expectBodyContains('next/part/of/path').toss();

	frisby.create('wildcard override')
		.get('http://localhost:8008/test/wild/override').expectStatus(200).expectBodyContains('no wildcard in route').toss();

	frisby.create('wildcard override correctly 404s on no match after override')
		.get('http://localhost:8008/test/wild/override/bingo').expectStatus(404).toss();

	frisby.create('url variables')
		.get('http://localhost:8008/test/divide/4/2').expectStatus(200).expectBodyContains('2').toss();

	frisby.create('error production')
		.get('http://localhost:8008/test/divide/4/0').expectStatus(500).expectBodyContains('Divide by 0').toss();

	frisby.create('inject constant')
		.get('http://localhost:8008/test/multiply/2/2').expectStatus(200).expectBodyContains('factoring in (2): 8').toss();

	frisby.create('call blocks in order of production')
		.get('http://localhost:8008/test/processOrder').expectStatus(200).expectBodyContains('callFirst callNext callLast').toss();

	frisby.create('skip a block if the values can\'t be produced')
		.get('http://localhost:8008/test/skipNotProduced').expectStatus(200).expectBodyContains('callFirst callLast').toss();

	frisby.create('post')
		.post('http://localhost:8008/test/replay', {a: 15}, {json: true})
		.expectStatus(200).expectBodyContains('You sent {"a":15}').toss();

	frisby.create('parse a query string correctly')
		.get('http://localhost:8008/test/query.parse?a=10&bob=alice').expectStatus(200).expectJSON({a: '10', 'bob' : 'alice'}).toss();

	frisby.create('enter filter and recursive production')
		.get('http://localhost:8008/test/factorial/4').expectStatus(200).expectBodyContains('24').toss();

	frisby.create('exit filter')
		.get('http://localhost:8008/test/makeFactorialNegative/4').expectStatus(200).expectBodyContains('-24').toss();

	it('should kill the server', function (done) {
		runningServer.kill('SIGTERM');
		done();
	})
});
