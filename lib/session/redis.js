var Redis = module.exports = function(conf) {
  this.conf = conf;
  this.store = App.store(conf.store.name);
}

Redis.prototype.read = function(id, callback) {
  this.store.get(this.conf.store.prefix +':'+ id, function(error, data) {
    if (error) {
      return callback(error);
    }

    callback(null, data ? JSON.parse(data) : {});
  });
}

Redis.prototype.write = Redis.prototype.save = function(id, data, callback) {
  this.store.setex(this.conf.store.prefix +':'+ id, this.conf.expires, JSON.stringify(data), callback);
}

Redis.prototype.delete = function(id, callback) {
  this.store.del(id, callback);
}
