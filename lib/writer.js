var _ = require('lodash');
var Bacon = require('baconjs');
var fs = require('fs');
var safeJSONStringify = require('json-stringify-safe');
var CONSTANTS = require('./constants.js');

function setHeader(headerStream, name, value) {
	headerStream.push({name: name, value: value});
}

function setCookie(cookieStream, name, value) {
	cookieStream.push({name: name, value: value});
}

function setStatus(statusStream, code) {
	statusStream.push(code);
}

function writeHeader(responder, status, headers, cookies) {
	_.forEach(Object.keys(headers), function (key) {
		responder.setHeader(key, String(headers[key]));
	});
	var cookieArray = _.reduce(_.keys(cookies), function (memo, key) {
		memo.push(key + '=' + cookies[key]);
		return memo;
	}, []);
	if (cookieArray.length) {
		responder.setHeader(CONSTANTS.HEADER_COOKIE, cookieArray);
	}
	responder.writeHead(status);
}

function writeBody(headerSetter, writeStream, ender, body) {
	if (typeof body === 'object') {
		body = safeJSONStringify(body, null, 1, function(k,v){});
		headerSetter(CONSTANTS.HEADER_CONTENT_TYPE, 'application/json');
	}
	else if (typeof body !== 'string') {
		body = String(body);
		headerSetter(CONSTANTS.HEADER_CONTENT_TYPE, 'text/plain');
	}
	headerSetter(CONSTANTS.HEADER_CONTENT_LENGTH, body.length);
	writeStream.push(body);
	ender();
}

function writeRedirect(statusSet, headerSet, writeStream, ender, redirectURL) {
	statusSet(301);
	headerSet('Location', redirectURL);
	writeStream.push(null);
	ender();
}

function writePartial(writeStream, partial) {
	if (typeof partial === 'object') {
		writeStream.push(partial);
	}
	else {
		writeStream.push(String(partial));
	}
}

function writeFile(statusSet, headerSet, writeStream, ender, type, filename, asAttachment) {

	var stat = Bacon.fromNodeCallback(fs.stat, filename);
	var readerStream = new Bacon.Bus();

	if (!filename) {
		filename = type;
		type = 'text/html';
	}

	stat.map('.size').doAction(function (size) {
		headerSet(CONSTANTS.HEADER_CONTENT_LENGTH, String(size));
		headerSet(CONSTANTS.HEADER_CONTENT_TYPE, type);
		if (asAttachment) {
			headerSet(CONSTANTS.HEADER_CONTENT_DISPOSITION, 'attachment; filename=' + asAttachment);
		}
	}).map(function (size) {
		return {
			size: size,
			name: filename
		};
	}).flatMap(function (input) {
		return Bacon.fromNodeCallback(fs.open, input.name, 'r').map(function (fd) {
			return {
				fd: fd,
				size: input.size,
				read: 0
			};
		});
	}).onValue(function (input) {
		readerStream.push(input);
	});

	readerStream.endOnError().onValue(function (input) {
		if (input.size <= 0) {
			ender();
			fs.close(input.fd, function () {});
			readerStream.end();
		}
		var b = new Buffer(4096);
		fs.read(input.fd, b, 0, 4096, input.read, function (err, read, buffer) {
			if (err) {
				readerStream.error(err);
				return;
			}
			writeStream.push(buffer);
			readerStream.push({
				fd: input.fd,
				size: (input.size - read),
				read: (input.read + read)
			});
		});
	});

	readerStream.onError(function (e) {
		console.log(e + ' while attempting to read ' + filename);
		ender();
		readerStream.end();
	});

	stat.onError(function (e) {
		console.log(e + ' while attempting to send ' + filename);
		statusSet(404);
		writeStream.push('File not found.');
		ender();
	});
}

function writeDone(headerStream, statusStream, cookieStream, writeStream) {
	headerStream.end();
	statusStream.end();
	cookieStream.end();
	writeStream.end();
}

function makeWriter(responder) {
	var writeStream = new Bacon.Bus();
	var headerStream = new Bacon.Bus();
	var cookieStream = new Bacon.Bus();
	var statusStream = new Bacon.Bus();

	var boundSetHeader = _.curry(setHeader)(headerStream);
	var boundSetCookie = _.curry(setCookie)(cookieStream);
	var boundStatus = _.curry(setStatus)(statusStream);
	var boundWriteHeaders = _.once(_.curry(writeHeader)(responder));
	var boundEnd = _.partial(writeDone, headerStream, statusStream, cookieStream, writeStream);

	var respondObj = {
		setHeader: boundSetHeader,
		setCookie: boundSetCookie,
		setStatus: boundStatus,
		writeBody: _.curry(writeBody)(boundSetHeader, writeStream, boundEnd),
		writeFile: _.partial(writeFile, boundStatus, boundSetHeader, writeStream, boundEnd),
		writePartial: _.curry(writePartial)(writeStream),
		redirect: _.partial(writeRedirect, boundStatus, boundSetHeader, writeStream, boundEnd),
		done: boundEnd
	};

	var writer = Bacon.combineTemplate({
		headers: headerStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
		cookies: cookieStream.scan({}, function (memo, value) {memo[value.name] = value.value; return memo;}),
		status: statusStream.toProperty().startWith(200),
		bodyPart: writeStream
	}).doAction(function (writeReady) {
		boundWriteHeaders(writeReady.status, writeReady.headers, writeReady.cookies);
	});

	writer.onValue(function (write) {
		if (write.bodyPart) {
			responder.write(write.bodyPart);
		}
	});

	writer.onEnd(function () {
		responder.end();
	});

	return respondObj;
}

module.exports = {
	makeWriter : makeWriter,
	testFnTap: {
		setHeader : setHeader,
		setCookie: setCookie,
		setStatus: setStatus,
		writeBody: writeBody,
		writeFile: writeFile,
		writePartial: writePartial,
		writeDone: writeDone
	}
};
