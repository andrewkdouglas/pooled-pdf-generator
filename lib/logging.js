/**
 * Module dependencies.
 */
var winston = require('winston');
var Loggly = require('winston-loggly');

/**
 * Logging module.
 *
 * A basic container for the Winston logging library
 *
 * @param {Object} Log configuration
 * @api public
 */
var Logging = function(config) {
  this.initialized = false;
  this.config = (config) ? config : {};
  this.logger;
  var self = this;
  this.logMessage = function(level,message){
    if(self.initialized){
     self.logger.log(level, message);
    }
  };
};

Logging.prototype.start = function() {
  // Initialise logging and return a logger instance
  var self = this;
  
  /*var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: (this.config.logFile) ? this.config.logFile : '/var/log/pooled-phantom-server.log', json: false }),
      new winston.transports.Loggly({subdomain: 'spidergap',inputToken:'87ab4fa2-71f7-4350-9fe8-0b58bad321a5',json:true})
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: (this.config.errorFile) ? this.config.errorFile : '/var/log/pooled-phantom-server.err', exitOnError: false, json: false })
    ]
  });*/
  
  
  var logger = new (winston.Logger)({ exitOnError: false });

  
  if(this.config.logToFile){
    logger.add(winston.transports.File, { filename: (this.config.logDir) ? this.config.logDir + 'pooled-phantom-server-info.log' : '/var/log/pooled-phantom-server-info.log', json: false, level: 'info', name: 'file.info' });
    logger.add(winston.transports.File, { filename: (this.config.logDir) ? this.config.logDir + 'pooled-phantom-server-warn.log' : '/var/log/pooled-phantom-server-warn.log', json: false, level: 'warn', name: 'file.warn' });
    logger.add(winston.transports.File, { filename: (this.config.logDir) ? this.config.logDir + 'pooled-phantom-server-error.log' : '/var/log/pooled-phantom-server-error.log', json: false, level: 'error', handleExceptions: true , name: 'file.error'});
  }
  
  if(this.config.logToLoggly){
    logger.add(winston.transports.Loggly ,{subdomain: this.config.logglySubdomain, inputToken: this.config.logglyInputToken, json:true, handleExceptions: true, name: 'loggly'});
  }
  
  if(this.config.logToConsole){
    logger.add(winston.transports.Console,{name:'console.all'});
  }
  
  
  this.logger = logger;
  this.initialized = true;
  
  this.logMessage('info','Logging started');
  
  return this;
};

Logging.prototype.log = function(message) {
  this.logMessage('info',message);
};

Logging.prototype.info = function(message) {
  this.logMessage('info',message);
};

Logging.prototype.warn = function(message) {
  this.logMessage('warn',message);
};

Logging.prototype.error = function(message) {
  this.logMessage('error',message);
};

module.exports = Logging;