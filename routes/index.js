var utils = require('../lib/utils');
var join = require('path').join;
var fs = require('fs');
var path = require('path');
var request = require('request');
var tmp = require('tmp');

tmp.setGracefulCleanup();


module.exports = function(app) {
  var pool = app.settings.phantomPool;
  var logger = app.settings.logger;
  var config = app.settings.config;


  // Clean up tmp on errors


  // routes
  
  //API security
  app.get('*', function(req, res, next) {
    if (!req.param('api', false)) {
      logger.warn('Malformed URL (missing api key): ' + req.originalUrl);
      res.send(400,'Error: Request must contain an api header');
      return;
    }
    
    if (!config.api[req.path.substring(1)]) {
      logger.warn('Malformed URL (invalid request path): ' + req.originalUrl);
      res.send(400,'Error: Request path invalid');
      return;
    }
    
    if (config.api[req.path.substring(1)] !== req.param('api')) {
      logger.warn('Security exception (invalid api key): ' + req.originalUrl);
      res.send(400,'Error: Invalid API key');
      return;
    }
    
    // All is ok, continue processing 
    next();
    
  });
  
  // Page to PDF route
  app.get('/pagetopdf', function(req, res, next) {
    if (!req.param('url', false)) {
      logger.warn('Malformed URL (missing url param): ' + req.originalUrl);
      res.send(400,'Error: Request must contain an url header');
      return;
    }
    var url = utils.url(req.param('url'));
    renderPDF(req,res,url);
  });
  
  
  // Base functions
  var renderPDF = function(req,res,url){
    pool.acquire(function(err, phinstance) {
      if (err) {
        logger.error('Failed to load rendering engine for request : ' + err);
        res.send(400,'Error: Failed to load rendering engine' + "\n");
        return;  
      }
      else {
        logger.log('Request for ' + url + ' - Rasterizing it');
        logger.log('Pool info (size:aval:wait): ' + pool.getPoolSize() + ':' + pool.availableObjectsCount() + ':' + pool.waitingClientsCount());
        

        // create a page
        phinstance.createPage(function(err,page){
          // Set page variables
          page.set('viewportSize',{ width: config.phantom.viewportSize.width, height: config.phantom.viewportSize.height });

          var paperSize = {
            format: config.phantom.paperSize.format,
            orientation: config.phantom.paperSize.orientation,
            footer: {
              height: '1cm',
              // Pass as a string to overcome a limitation of node-phantom (also requires us updating bridge.js within the node-phantom package)
              // See description here: http://stackoverflow.com/questions/17102287/footers-contents-dont-seem-to-work
              contents: 'function(pageNum, numPages) { if(pageNum > 1) { return \'<div style="text-align: center;font-family:Arial;font-size:12px;color:#333">\' + pageNum + \'</div>\'; } }'
            },
            margin: {
              top: '2cm',
              left: '2cm',
              right: '2cm',
              bottom: '1cm'
            }
          };

          page.set('paperSize', paperSize);
          
          page.set('zoomFactor', config.phantom.zoomFactor);
        
          // Open page
          page.open(url, function (err,status) {
            if (err || status !== 'success') {
                pool.release(phinstance);
                logger.warn('Failed to fetch page to render: ' + req.originalUrl);
                res.send(400,'Error: Failed to fetch page to render' + "\n");
                return;
            } else {
              // Wait for the page to be ready (using eval)
              waitForPageJS(page,function(){return window.pageLoaded === true;}, function() {
                page.evaluate(function(){return window.pageError === true;},function(err,result){
                  if(result){
                    pool.release(phinstance);
                    logger.warn('Failed to fetch page to render: ' + req.originalUrl);
                    res.send(400,'Error: Failed to fetch page to render' + "\n");
                    return;
                  }
                  else{
                    // Create tmp file to store pdf
                    //tmp.file({ mode: config.tmp.mode, prefix: config.tmp.prefix, postfix: config.tmp.postfix }, function _tempFileCreated(err, path, fd) {
                    tmp.file({ template: config.tmp.pattern }, function _tempFileCreated(err, path, fd) {
                      if(err){
                        pool.release(phinstance);
                        logger.warn('Failed to create tmp file: ' + req.originalUrl);
                        res.send(400,'Error: Failed to create tmp file' + "\n");
                        return;
                      }
                      // Render page to pdf
                      page.render(path,function(err){
                        if(err){
                          pool.release(phinstance);
                          logger.warn('Failed to render page: ' + req.originalUrl);
                          res.send(400,'Error: Failed to render page' + "\n");
                          return;
                        }
                        // Send back
                        res.sendfile(path, function(err) {
                          if(err){
                            pool.release(phinstance);
                            fs.unlinkSync(path);
                            logger.warn('Failed to return page: ' + req.originalUrl);
                            res.send(400,'Error: Failed to return page' + "\n");
                            return;
                          }
                          fs.unlinkSync(path);
                      
                          // Close page
                          page.close();
                      
                          // Release phantom instance
                          pool.release(phinstance);
                        });        
                
                      });
                    });
                  }
                });
              },function(){
                pool.release(phinstance);
                logger.warn('Failed to fetch page to render: ' + req.originalUrl);
                res.send(400,'Error: Failed to fetch page to render' + "\n");
                return;
              },config.phantom.timeout);
            }
          });
        });
      }
    });
  
  };
  
  
  // Waits for a JS test to evaluate true on the page in Phantom
  var waitForPageJS = function(page, testFx, onReady, onFail, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 12000, //< Default Max Timout is 12s
        start = new Date().getTime(),
        condition = false,
        evaluating = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
              // If not time-out yet and condition not yet fulfilled
              if(!evaluating){
                evaluating = true;
                page.evaluate(testFx,function(err,result){
                  if(!err){
                    condition = result;
                    evaluating = false;
                  }
                });
              }
              
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    logger.log("'waitFor()' timeout");
                    typeof(onFail) === "string" ? eval(onFail) : onFail();
                    clearInterval(interval); //< Stop this interval
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    logger.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 250); //< repeat check every 250ms
  };
  
};