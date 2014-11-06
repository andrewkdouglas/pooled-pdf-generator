// Module dependencies.
var config = require('config');
var express = require('express');
var PhantomPool = require('./lib/phantomPool');
var Logging = require('./lib/logging');

// Web service
var app = express();
var logger = new Logging(config.logger).start();

switch (app.settings.env) {
case 'development':
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
  break;
default:
  app.use(app.router);
  break;
}

app.set('logger', logger);
app.set('phantomPool', new PhantomPool(config.phantomPool, logger).create());
app.set('config', config.app);

require('./routes')(app);
var server = app.listen(config.server.port);
app.settings.logger.log('Express server listening on port ' + config.server.port);

// Error handling
process.on('uncaughtException', function (err) {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

process.on('SIGTERM', function () {
  process.exit(0);
});

process.on('SIGINT', function () {
  process.exit(0);
});