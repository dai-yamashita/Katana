var conf = App.get('session');
var storeProvider = App.get(':stores '+ conf.store.name +' provider');

var store = null;

var token = App.utils.token;

var Session = App.session = module.exports = function(id, callback) {
  var self = this;

  !(self.id = id) && self.generate();
  self.data = conf.defaults;

  store.read(id, function(error, data) {
    if (error) {
      return callback(error);
    }

    self.data = data;

    callback(null, self);
  });
}

Session.prototype = {
  data: {},

  set: function(name, value) {
    this.data[name] = value;
  },

  get: function(name) {
    return this.data[name];
  },

  delete: function(name) {
    delete this.data[name];
  },

  clear: function() {
    this.data = {};
  },

  save: function(callback) {
    store.save(this.id, this.data, callback);
  },

  reset: function() {
    store.delete(this.id);
    this.generate();
  },

  generate: function() {
    this.id = token(conf.key.length);
    this.data = conf.defaults;
  }
}

Session.stores = {};
Session.store = function(name, provider) {
  Session.stores[name] = provider;
}

Session.stores.memory   = require('./memory');
Session.stores.redis    = require('./redis');
Session.stores.mongoose = require('./mongoose');
// Session.stores.mysql = require('./mysql');
// Session.stores.memcache = require('./memcache');

App.on('start', function() {
  store = new Session.stores[storeProvider](conf);
});

App.use(function(request, response, next) {
  request.pause();

  response.on('header', function() {
    response.cookies.set(conf.key.name, request.session.id, { expires: conf.expires });
  });

  var end = response.end;
  response.end = function(data, encoding) {
    response.end = end;
    
    response.session.save(function(error) {
      if (error) { console.log(error); }

      response.end(data, encoding);
    });
  }

  new Session(request.cookies.get(conf.key.name), function(error, session) {
    if (error) {
      console.log(error);
    }

    request.session = response.session = session;
    request.resume();

    next();
  });
});
