/**
 * Module dependencies.
 */
var poolModule = require('generic-pool');
var phantom = require('node-phantom');

/**
 * Phantom pool.
 *
 * Holds a pool of phantom instances
 *
 * @param {Object} Pool configuration
 * @api public
 */
var PhantomPool = function(config,logger) {
  this.initialized = false;
  this.config = (config) ? config : {};
  this.pool;
  this.phantomBin = (this.config.phantomBinary) ? this.config.phantomBinary : false;
  var self = this;
  this.logger = logger;
  process.on('exit', function() {
    self.empty();
  });
};

PhantomPool.prototype.create = function(callback) {
  // Create the pool and return a pool instance
  var self = this;
  // Create pool
  var pool = poolModule.Pool({
      name     : (this.config.name) ? this.config.name : 'phantom',
      create   : function(callback) {
        if(self.phantomBin){
          phantom.create(callback,{phantomPath:self.phantomBin});
        }
        else{
          phantom.create(callback);
        }
      },
      destroy  : function(ph) {
        console.log('destroy');
        console.log(ph);
        ph.exit();
      },
      max      : (this.config.poolMax) ? this.config.poolMax : 10,
      // optional. if you set this, make sure to drain() (see step 3)
      min      : (this.config.poolMin) ? this.config.poolMin : 2, 
      // specifies how long a resource can stay idle in pool before being removed
      idleTimeoutMillis : (this.config.poolIdleTime) ? this.config.poolIdleTime : 30000,
       // if true, logs via console.log - can also be a function
      log : (this.config.poolLog === true) ? true : false 
  });
  
  this.pool = pool;
  this.initialized = true;
  this.logger.log('Pool started using "' + (this.phantomBin ? this.phantomBin : 'PATH/phantomjs') + '"');
  return this;
};

PhantomPool.prototype.empty = function(callback) {
  // Kill the pool
  var self = this;
      console.log('draining called');

  this.pool.drain(function() {
        console.log('now distroy');
    console.log(self.pool);

    self.pool.destroyAllNow();
  });
  this.initialized = false;
};

PhantomPool.prototype.acquire = function(callback) {
  // create the pool and return a pool instance
  return this.pool.acquire(callback);
};

PhantomPool.prototype.release = function(instance) {
  return this.pool.release(instance);
};

PhantomPool.prototype.restart = function(callback) {
  if (this.initialized) {
    this.empty();
  }
  this.create();
};

PhantomPool.prototype.getPoolSize = function(){
  return this.pool.getPoolSize();
};

PhantomPool.prototype.availableObjectsCount = function(){
  return this.pool.availableObjectsCount();
};

PhantomPool.prototype.waitingClientsCount = function(){
  return this.pool.waitingClientsCount();
};

module.exports = PhantomPool;