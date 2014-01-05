var Store = module.exports = function(name) {
  return Store.stores[name];
}

Store.providers = {};
Store.stores = {};

Store.provider = function(name, factory) {
  this.providers[name] = factory;
}

Store.connect = function(name, options, callback) {
  var provider = this.providers[name];

  provider(options, callback);
}

Store.provider('memory', function(conf, done) {
  return done(null, {
    data: {},

    set: function(key, value) {
      this.data[key] = value;
    },

    get: function(key) {
      return this.data[key];
    },

    delete: function(key) {
      if (!key) {
        return this.clear();
      }
      return delete this.data[key];
    },

    clear: function() {
      this.data = {};
    }
  });
});

Store.provider('mongoose', function(conf, done) {
  var Mongoose = require('mongoose');
  var connection = null;

  if (conf.uri) {
    connection = Mongoose.createConnection(config.uri);
  } else {
    connection = Mongoose.createConnection(conf.host, conf.database, conf.port, conf.options);
  }

  connection.once('open', function() {
    done(null, connection);
  });

  // TODO: fix this, connection hangs but error is not emitted?
  connection.on('error', done);
});

Store.provider('mongodb', function(conf, done) {
  var Mongo = require('mongodb');

  var server = new Mongo.Server(conf.host, conf.port, conf.options.server);
  var db     = new Mongo.Db(conf.database, server, conf.options.database);

  db.open(function(error) {
    done(error, db);
  });
});

Store.provider('mysql', function(conf, done) {
  var MySQL = require('mysql');

  var connection = MySQL.createConnection({
    host:     conf.host,
    port:     conf.port,
    user:     conf.username,
    password: conf.password,
    database: conf.database
  });

  connection.connect(function(error) {
    done(error, connection);
  });

  connection.on('error', function(error) {
    console.log(error);
  });
});

Store.provider('postgre', function(conf, done) {
  var Postgre = require('pg');

  var connection = new Postgre.Client({
    host:     conf.host,
    port:     conf.port,
    user:     conf.username,
    password: conf.password,
    database: conf.database
  });

  connection.connect(function(error) {
    done(error, connection);
  });

  connection.on('error', function(error) {
    console.log(error);
  });
});

Store.provider('redis', function(conf, done) {
  var Redis = require('redis');

  var connection = Redis.createClient(conf.port || conf.socket, conf.host, conf.options);

  if (conf.password) {
    connection.auth(conf.password, function(error) {
      done(error);
    });
  }

  if (conf.database) {
    connection.on('connect', function() {
      connection.send_anyways = true;
      connection.select(conf.database);
      connection.send_anyways = false;
    });
  }

  connection.on('ready', function() {
    done(null, connection);
  });

  connection.on('error', function(error) {
    console.log(error);
  });
});
