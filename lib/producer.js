var _ = require('lodash');

function value(stream, fnName, canMake, post, name, val) {
	if (_.indexOf(canMake, name) === -1) {
		console.log('ERROR: Function (name: ' + fnName + ') attempted to produce "' + name + '" but only declared ' + JSON.stringify(canMake) +
		'.  Ignoring.');
		return;
	}
	var pushObj = {
		name: name,
		value: val
	};
	if (typeof post === 'function') {
		stream.push(post(pushObj));
	}
	else {
		stream.push(pushObj);
	}
}

function finalValue(stream, fnName, canMake, post, name, val) {
	value(stream, fnName, canMake, post, name, val);
	end(stream);
}

function error(stream, code, description) {
	stream.error({code: code, description: description});
}

function end(stream) {
	stream.end();
}

function fromNodeCallback(producer, produces, cbPos, fn, bindThis) {
	if (!_.isArray(produces)) {
		produces = [produces];
	}
	var fnArgs = Array.prototype.slice.call(arguments, 5);
	var callback = function () {
		if (!_.isUndefined(arguments[0]) && !_.isNull(arguments[0])) {
			return producer.error(500, arguments[0]);
		}
		var args = Array.prototype.slice.call(arguments, 1);
		args.forEach(function (val, i) {
			if (produces[i] && produces[i].length) {
				producer.value(produces[i], val);
			}
		});
		producer.done();
	};
	var applyArgs;
	if (cbPos < 0 || cbPos >= fnArgs.length) {
		applyArgs = fnArgs.concat([callback]);
	}
	else {
		applyArgs = fnArgs.slice(0, cbPos).concat([callback]).concat(fnArgs.slice(cbPos));
	}
	fn.apply(bindThis, applyArgs);
}

function makeProducer(onDef, productionStream) {
	var producer = {
		value: _.curry(value)(productionStream, onDef.name, onDef.produces, onDef.exit),
		finalValue: _.curry(finalValue)(productionStream, onDef.name, onDef.produces, onDef.exit),
		error: _.curry(error)(productionStream),
		done: _.partial(end, productionStream)
	};

	producer.fromNodeCallback = _.curry(fromNodeCallback)(producer);
	return producer;
}

module.exports = {
	makeProducer : makeProducer,
	testFnTap : {
		value: value,
		error : error,
		end: end,
		fromNodeCallback: fromNodeCallback
	}
};
