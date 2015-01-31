'use strict';

var FRHttp = require('./lib/frhttp.js'),
	server = FRHttp.createServer();

require('./samples/hello.world.js')(server);
require('./samples/multiply.js')(server);
require('./samples/divide.js')(server);
require('./samples/check.square.js')(server);
require('./samples/post.back.js')(server);
require('./samples/factorial.js')(server);
require('./samples/from.callback.js')(server);
require('./samples/inject.js')(server);
require('./samples/db.simulation.js')(server);
require('./samples/uncaught.exception.js')(server);
require('./samples/send.file.js')(server);
require('./samples/query.string.js')(server);

server.listen(8001);