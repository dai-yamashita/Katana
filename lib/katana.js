var Http   = require('http');
var Https  = require('https');
var Domain = require('domain');
var Path   = require('path');
var Fs     = require('fs');

var EventEmitter = require('events').EventEmitter;

var Async = require('async');
var _     = require('underscore');

var Url         = require('url');
var parseQuery  = require('qs').parse;

var find       = require('./fs').find;
var utils      = require('./utils');
var sanitize   = utils.sanitize;
var merge      = utils.merge;
var map        = Object.map;

var isWin = process.platform === 'win32';
var eol = require('os').EOL;
var sep = Path.sep;

module.exports = global.App = new EventEmitter;

App.setMaxListeners(0);

App.version = require('../package.json').version;
App.env     = process.env.NODE_ENV || 'development';
App.root    = Path.dirname(process.mainModule.filename) + Path.sep;
App.info    = require(App.root + 'package.json');

process.chdir(App.root);

App.middlewares = {};
App.settings    = {};

App._modules = ['app'].concat(
  Object.keys(App.info.katana.modules).filter(function(name) { 
    return App.info.katana.modules[name].enabled; 
  })
);

App.resolve = function(path) {
  var module = 'app';
  var match  = null;

  path = path.trim().replace(/\s+|\./g, '/');

  if (match = path.match(/(.*)\:(.*)/)) {
    module = match[1];
    path   = match[2].trim();
  }

  return module +'/'+ path;
}

function resolveKey(path) {
  var module = 'app';
  var conf   = 'app';
  var match  = null;

  if (match = path.match(/(\w+)?\:([^\.\s]+)?(?:[\.\s]*)?(.*)?/)) {
    module = match[1] || module;
    conf   = match[2] || (module==='app' ? conf : module);
    path   = match[3] || '';
  }

  path = path.trim().replace(/\s+|\./g, '/');

  return (module +'/'+ conf + (path ? '/'+ path : ''));
}

App.get = function(key) {
  if (!key) { return this.settings; }

  var path   = resolveKey(key).split('/');
  var target = this.settings[path.shift()];

  if (!path.length) {
    return target;
  }

  while(path.length > 0) {
    key = path.shift();

    if (target && target.hasOwnProperty(key)) {
      target = target[key];
      continue;
    }

    return undefined;
  }

  return target;
}

App.set = function(key, value) {
  var path   = resolveKey(key).split('/');
  var module = path.shift();
  var target = this.settings[module];

  if (!target) { target = this.settings[module] = {}; }
  if (!path.length) { return false; }

  while(path.length > 1) {
    key = path.shift();

    if (typeof(target[key]) !== 'object') {
      target[key] = {};
    }

    target = target[key];
  }

  key = path.shift();
  target[key] = value;

  return true;
}

App.enable = function(key) {
  this.set(key, true);
}

App.disable = function(key) {
  this.set(key, false);
}

App.enabled = function(key) {
  return !!this.get(key);
}

App.disabled = function(key) {
  return !this.get(key);
}

App.readConf = function(env) {
  var self = this;

  env = env || 'development';

  self._modules.forEach(function(module) {
    var dir = self.root + (module==='app' ? 'app' : 'modules/'+ module) +'/config/';

    if (Fs.existsSync(dir + env) && Fs.statSync(dir + env).isDirectory()) {
      Fs.readdirSync(dir + env).forEach(function(file) {
        if (Path.extname(file) !== '.js' && Path.extname(file) !== '.json') { return; }

        var name = Path.basename(file, Path.extname(file));
        var conf = require(dir + env +'/'+ file);

        self.set(module +':'+ name, (env==='development' ? conf : merge(self.get(module +':'+ name), conf)));
      });
    }
  });
}

App.readConf(); (App.env !== 'development') && App.readConf(App.env);

require('./cli-args');

App.logger = require('./logger');
App.log = function() {
  App.logger.log.apply(App.logger, [].slice.call(arguments));
}

var Request  = require('./request');
var Response = require('./response');

App.start = function() {
  var http  = this.get('http');
  var https = this.get('https');

  var wait = !!http + !!https;

  if (http) {
    var httpHost = http.host || '127.0.0.1';
    var httpPort = http.port || 8000;

    this.http = Http.createServer(wrapRequest);
    this.http.listen(httpPort, httpHost, function() {
      console.log('Katana HTTP server on:', httpHost +':'+ httpPort);

      (!--wait) && App.emit('ready');
    });
  }

  if (https) {
    var httpsHost = https.host || (http && http.host) || '127.0.0.1';
    var httpsPort = https.port || 443;

    this.https = Https.createServer({
      key:  https.key  || null,
      cert: https.cert || null,
      ca:   https.ca   || null
    }, wrapRequest);
    this.https.listen(httpsPort, httpsHost, function() {
      console.log('Katana HTTPS server on:', httpsHost +':'+ httpsPort);

      (!--wait) && App.emit('ready');
    });
  }
}

function wrapRequest(request, response) {
  var domain = Domain.create();

  domain.on('error', function(error) {
    if (response.headersSent) {
      return response.end();
    }

    response.send(500);
  });

  domain.add(request);
  domain.add(response);

  domain.run(function() {
    App.handleRequest(request, response);
  });
}

var staticsEnabled = App.get('statics enabled');
if (staticsEnabled) {
  var conf = App.get('statics');
  var staticsPath = (conf.path || 'public') + '/';

  var Static = new (require('node-static').Server)({
    cache:      conf.cache || 7200,
    serverInfo: conf.serverInfo || ('Katana v'+ App.version),
    headers:    conf.headers,
    gzip:       conf.gzip
  });
}

App.handleRequest = function(request, response) {
  var self = this;

  if (request.url === '/favicon.ico') {
    request.url = self.get('favicon') || 'public/images/favicon.ico';
  }

  request.__proto__  = Request;
  response.__proto__ = Response;

  request.response = response;
  response.request = request;

  request.originalUrl = request.url;
  request.url         = utils.decodeURI(request.url);
  request.parsedUrl   = Url.parse(request.url);
  request.path        = sanitize(request.parsedUrl.pathname).trim('\\s\/');
  request.targetPath  = Path.normalize(request.path) + '/';
  request.query       = request.parsedUrl.query ? parseQuery(request.parsedUrl.query) : {};
  request.data        = {};
  request.files       = {};
  
  if (isWin) {
    request.targetPath = request.targetPath.replace(/\\/g, '/');
  }

  if (staticsEnabled && request.targetPath.indexOf(staticsPath) === 0) {
    return Static.serve(request, response);
  }

  request.route = self.router.route(request.path, request.method);

  if (request.module !== 'app') {
    // var params = request.route.params;
    // request.originalRoute = request.route;

    request.route = self.router.route(request.route.routed, request.method, request.module);
    // route.params = merge(params, route.params);
  }

  self.callMiddlewares(request, response, function(error) {
    if (error) {
      // return response.send(error);
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end(error);
      return;
    }

    self.handle(request, response);
  });
}

var controller404 = App.get(':routing _404 controller') || 'home';
var action404     = App.get(':routing _404 action') || '_404';

App.handle = function(request, response) {
  var self       = this;
  var controller = self.controllers[request.module +'/'+ request.directory + request.controller];
  var _404       = false;

  if (!controller) {
    controller = self.controllers['app/'+ controller404];
    _404 = true;
  }

  if (controller) {
    var method = _404 ? controller[action404] : (controller[request.action] || controller._call || controller[action404]);

    if (typeof(method) === 'function') {
      method = method.bind(controller);
      method(request, response);
    } else {
      response.send(404, 'action not found');
    }
  } else {
    response.send(404, 'controller not found');
  }
}

App.use = function(type, fn) {
  if (typeof(type) === 'function') {
    fn = type; type = '_';
  }

  (this.middlewares[type] || (this.middlewares[type] = [])).push(fn);
}

App.callMiddlewares = function(request, response, done) {
  var self = this;
  var index = 0;

  if (!this.middlewares._.length) {
    return done();
  }

  function next(request, response) {
    var fn = self.middlewares._[index];

    fn(request, response, function(error) {
      if (error) {
        return done(error);
      }

      if ((self.middlewares._.length - 1) > index++) {
        return next(request, response);
      }

      done();
    });
  }

  next(request, response);
}

App.call = function(path) {
  var segments = path.split('/');
  var action   = segments.pop();
  var controller = this.controller(segments.join('/'));

  var args = [].slice.call(arguments, 1);

  if (!controller || typeof(controller[action])!=='function') {
    var callback = typeof(args[args.length-1])==='function' ? args[args.length-1] : function(error) {
      throw error;
    }

    return callback(new Error('controller '+ segments.join('/') +' has no method '+ action));
  }

  controller[action].apply(controller, args);
}

setImmediate(function() {
  Async.series({
    stores: function(next) {
      var stores = App.get(':stores');

      stores = map(stores, function(name, options) {
        var fn = function(next) {
          App.store.connect(this.provider, this, next);
        };

        return [name, fn.bind(options)];
      });

      Async.parallel(stores, function(error, connections) {
        if (error) {
          return next(error);
        }

        App.store.stores = connections;

        next();
      });
    },

    models: function(next) {
      importFiles('models', next);
    },

    views: function(next) {
      importFiles('views', function(filePath) {
        return Fs.readFileSync(filePath, 'utf-8');
      }, next);
    },

    modules: function(next) {
      App.modules = {};
      App._modules.forEach(function(module) {
        if (module !== 'app') {
          App.modules[module] = require(App.root +'modules/'+ module);
        }
      });

      next();
    },

    controllers: function(next) {
      importFiles('controllers', next);
    }
  }, function(error) {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    App.emit('start');

    App.start();
  });
});

App.model = function(path) {
  return App.models[this.resolve(path)];
}

App.controller = function(path) {
  return App.controllers[this.resolve(path)];
}

App.module = function(name) {
  return (name ? this.modules[name] : this.modules);
}

function importFiles(type, fn, next) {
  if (arguments.length < 3) {
    next = fn; fn = function(file) {
      return require(file);
    }
  }

  Async.each(App._modules, function(module, cb) {
    var path = App.root + (module === 'app' ? ['app', type] : ['modules', module, type]).join(sep);

    find(path, function(error, files) {
      if (error) { return cb(error); }

      var items = {};
      files.forEach(function(file) {
        var dir      = Path.dirname(Path.relative(path, file)); dir==='.' && (dir='');
        var name     = Path.basename(file, Path.extname(file));
        var itemPath = dir ? dir +'/'+ name : name;

        items[itemPath] = fn(file, itemPath, dir, name);
      });

      _.extend(App[type] || (App[type] = {}), map(items, function(name, item) {
        return [module +'/'+ name, item];
      }));

      cb();
    });
  }, next);
}

App.utils  = utils;

App.view   = require('./view');
App.render = App.view.render.bind(App.view);

App.router = require('./router');
App.store  = require('./store');
App.Controller = require('./controller');

App.get('cookies enabled')     && require('./cookies');
App.get('session enabled')     && require('./session');
App.get('multiparser enabled') && require('./multiparser');
