var producer = require('../lib/producer.js');
var Bacon = require('baconjs');

describe('Producer tests', function () {
	var theStream;

	beforeEach(function () {
		theStream = new Bacon.Bus();
	});

	afterEach(function () {
		theStream.end();
	});

	it('should produce a value on the stream', function (done) {
		theStream.onValue(function (theVal) {
			expect(theVal.name).toBe('valueName');
			expect(theVal.value).toBe('theValue');
			done();
		});
		producer.testFnTap.value(theStream, 'test function', ['valueName'], null, 'valueName', 'theValue');
	});

	it('should refuse to produce an undeclared value', function (done) {
		theStream.onValue(function () {
			expect(1).toBe(2);
		});
		spyOn(console, 'log');
		producer.testFnTap.value(theStream, 'test function', ['valueName'], null, 'someOtherValueName', 'theValue');
		expect(console.log).toHaveBeenCalled();
		done();
	});

	it('should finish producing values', function (done) {
		theStream.onEnd(function (val) {
			done();
		});
		producer.testFnTap.end(theStream);
	});

	it('should not produce a value after end', function (done) {theStream.onValue(function (theVal) {
		expect(theVal.name).toBe('valueName');
		expect(theVal.value).toBe('theValue');
	});
		producer.testFnTap.value(theStream, 'test function', ['valueName'], null, 'valueName', 'theValue');
		producer.testFnTap.end(theStream);
		producer.testFnTap.value(theStream, 'test function', ['valueName'], null, 'valueName', 'theOtherValue');
		done();
	});
});