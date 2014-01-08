var Http = require('http');
var Path = require('path');
var Fs   = require('fs');

var nodeStatic = require('node-static');
var fileServer = new nodeStatic.Server(App.root);

var mime = require('mime');

var utils          = require('./utils');
var sanitize       = utils.sanitize;
var normalizeType  = utils.normalizeType;
var normalizeTypes = utils.normalizeTypes;
var etag           = utils.etag;
var basename       = Path.basename;
var extname        = Path.extname;

var statusCodes = Http.STATUS_CODES;

var response = module.exports = {
  __proto__: Http.ServerResponse.prototype
};

response.__defineGetter__('req', function() {
  return this.request;
});

response.status = function(code) {
  this.statusCode = code;

  return this;
}

response.links = function(links) {
  var link = this.get('link') || '';

  if (link) { link += ', '; }

  return this.set('link', link + Object.keys(links).map(function(rel) {
    return '<'+ links[rel] +'>; rel="'+ rel +'"';
  }).join(', '));
}

response.contentType = 
response.type = function(type) {
  return this.set('Content-Type', ~type.indexOf('/') ? type : mime.lookup(type));
}

response.format = function(obj) {
  var request = this.request;

  var fn = obj.default;
  if (fn) {
    delete obj.default;
  }

  var keys = Object.keys(obj);
  var key  = request.accepts(keys);

  this.vary('accept');

  if (key) {
    var type    = normalizeType(key).value;
    var charset = mime.charsets.lookup(type);

    if (charset) { type += '; charset='+ charset; }

    this.set('Content-Type', type);

    obj[key](request, this);
  } else if (fn) {
    fn();
  } else {
    response.writeHead(406, { 'Content-Type': 'text/plain' });
    response.end('Not Acceptable');
    return;
    // use this.send(error)? or this.send(error.status, error.message);
    var error = new Error('Not Acceptable');
    error.status = 406;
    error.types = normalizeTypes(keys).map(function(o) { return o.value; })
    this.send(error);
  }

  return this;
}

response.set = 
response.header = function(name, value) {
  if (arguments.length === 2) {
    value = Array.isArray(value) ? value.map(String) : String(value);
    this.setHeader(name, value);
  } else {
    for (var key in name) {
      this.set(key, name[key]);
    }
  }

  return this;
}

response.get = function(name) {
  return this.getHeader(name);
}

response.location = function(url) {
  var request = this.request;
  var path = null;

  var map = { back: request.get('referer') || '/' };

  url = map[url] || url;

  if (!~url.indexOf('://') && url.indexOf('//') !== 0) {
    if (url[0] === '.') {
      path = request.originalUrl.split('?')[0];
      path = path + (path[path.length - 1]==='/' ? '' : '/');
      url = resolve(path, url);
    } else if (url[0] !== '/') {
      // prepend baseUrl?
      // path = App.get('baseUrl');
      // url  = path +'/'+ url;
      url = '/'+ url;
    }
  }

  this.set('Location', url);

  return this;
}

response.redirect = function(url) {
  var head   = this.request.method === 'HEAD';
  var status = 302;
  var body   = null;

  if (arguments.length === 2) {
    if (typeof(url) === 'number') {
      status = url;
      url = arguments[1];
    } else {
      status = arguments[1];
    }
  }

  this.location(url);

  url = this.get('location');

  this.format({
    text: function() {
      body = statusCodes[status] +'. Redirecting to '+ encodeURI(url);
    },

    html: function() {
      var u = utils.escape(url);
      body = '<p>'+ statusCodes[status] +'. Redirecting to <a href="'+ u +'">'+ u +'</a></p>';
    },

    default: function() {
      body = '';
    }
  });

  this.statusCode = status;
  this.set('Content-Length', Buffer.byteLength(body));
  this.end(head ? null : body);
}

response.vary = function(name) {
  var self = this;

  if (!name) { return this; }

  if (Array.isArray(name)) {
    name.forEach(function(name) {
      self.vary(name);
    });
    return;
  }

  var vary = this.get('vary');
  if (vary) {
    vary = vary.split(/ *, */); 
    !~vary.indexOf(name) && vary.push(name);

    this.set('Vary', vary.join(', '));

    return this;
  }

  this.set('Vary', name);

  return this;
}

response.send = function(status, body) {
  var request = this.request;
  var head    = request.method === 'HEAD';
  var len     = null;

  if (body === undefined) {
    body = status; 
    status = null;
  } else {
    this.statusCode = status;
  }
  
  var type = typeof(body);

  if (!status && type==='number') {
    this.get('Content-Type') || this.type('txt');
    this.statusCode = body;
    body = statusCodes[body];
  } else if (type === 'string') {
    if (!this.get('Content-Type')) {
      this.charset = this.charset || 'utf-8';
      this.type('html');
    }
  } else if (type==='object' || type==='boolean') {
    if (body == null) {
      body = '';
    } else if (Buffer.isBuffer(body)) {
      this.get('Content-Type') || this.type('bin');
    } else {
      return this.json(body);
    }
  }

  if (body !== undefined && !this.get('Content-Length')) {
    this.set('Content-Length', (len = Buffer.isBuffer(body)) ? body.length : Buffer.byteLength(body));
  }

  if (App.get('etag') && len && request.method==='GET') {
    if (!this.get('ETag')) {
      this.set('Etag', etag(body));
    }
  }

  if (request.fresh) { this.statusCode = 304; }
  if (this.statusCode===204 || this.statusCode===304) {
    this.removeHeader('Content-Type');
    this.removeHeader('Content-Length');
    this.removeHeader('Transfer-Encoding');

    body = '';
  }

  this.end(head ? null : body);

  return this;
}

response.json = function(status, obj) {
  if (obj === undefined) {
    obj = status; 
    status = null;
  } else {
    this.statusCode = status;
  }

  var replacer = App.get('json replacer');
  var spaces   = App.get('json spaces');
  var body     = JSON.stringify(obj, replacer, spaces);

  this.charset = this.charset || 'utf-8';
  this.get('Content-Type') || this.set('Content-Type', 'application/json');

  return this.send(body);
}

response.jsonp = function(status, obj) {
  if (obj === undefined) {
    obj = status; 
    status = null;
  } else {
    this.statusCode = status;
  }

  var replacer = App.get('json replacer');
  var spaces   = App.get('json spaces');
  var body     = JSON.stringify(obj, replacer, spaces).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  var callback = App.get('jsonp callback');

  this.charset = this.charset || 'utf-8';
  this.set('Content-Type', 'application/json');

  if (callback) {
    !Array.isArray(callback) && (callback = [callback]);
    for (var i=0; i<callback.length; i++) {
      var cb = this.request.query[callback[i]];

      if (cb) {
        if (Array.isArray(cb)) { cb = cb[0]; }

        this.set('Content-Type', 'text/javascript');

        cb = cb.replace(/[^\[\]\w$.]/g, '');
        body = 'typeof '+ cb +' === \'function\' && '+ cb +'('+ body +');';

        break;
      }
    }
  }

  return this.send(body);
}

response.attachment = function(filename) {
  if (filename) { this.type(extname(filename)); }

  this.set('Content-Disposition', filename ? 'attachment; filename="'+ basename(filename) +'"' : 'attachment');

  return this;
}

response.sendFile = function(status, path, headers, callback) {
  if (typeof(status) === 'string') {
    callback = headers; headers = path; path = status; status = 200;
  }

  if (typeof(headers) === 'function') {
    callback = headers; headers = null;
  }

  var promise = fileServer.serveFile(path, status, headers || {}, this.request, this);

  promise.on('error', function(error) {
    callback && callback(error);
  });

  promise.on('success', function(result) {
    callback && callback(null, result);
  });

  return this;
}

response.download = function(path, filename, callback) {
  if (typeof(filename) === 'function') {
    callback = filename;
    filename = null;
  }

  filename = filename || path;

  this.set('Content-Disposition', 'attachment; filename="'+ basename(filename) +'"');

  return this.sendFile(path, callback);
}

response.render = function(path, data) {
  var self = this;

  App.render(path, data, function(error, content) {
    if (error) {
      return self.send(500);
    }

    self.send(content);
  });
}


// 'header' event patch
var setHeader = response.setHeader;
var writeHead = response.writeHead;
var _renderHeaders = response._renderHeaders;

response.__defineGetter__('headerSent', function() {
  return this.headersSent;
});

response.setHeader = function(field, value) {
  var key = field.toLowerCase();
  var prev;

  if (this._headers && key==='set-cookie') {
    if (prev = this.getHeader(field)) {
      if (Array.isArray(prev)) {
        value = prev.concat(value);
      } else if (Array.isArray(value)) {
        value = value.concat(prev);
      } else {
        value = [prev, value];
      }
    }
  } else if (key==='content-type' && this.charset) {
    value += '; charset='+ this.charset;
  }

  return setHeader.call(this, field, value);
}

response._renderHeaders = function() {
  if (!this._emittedHeader) {
    this.emit('header');
  }

  this._emittedHeader = true;

  return _renderHeaders.call(this);
}

response.writeHead = function(statusCode, reasonPhrase, headers) {
  if (typeof(reasonPhrase) === 'object') { headers = reasonPhrase; }
  if (typeof(headers) === 'object') {
    Object.keys(headers).forEach(function(key) {
      this.setHeader(key, headers[key]);
    }, this);
  }

  if (!this._emittedHeader) { this.emit('header'); }

  this._emittedHeader = true;

  return writeHead.call(this, statusCode, reasonPhrase);
}
