var FRHttp = require('./lib/frhttp.js');

var server = FRHttp.createServer();

server.GET('/api/client/:clientId').log();
server.GET('/api/client/:clientId/package/:package').log();
