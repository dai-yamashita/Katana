var Mongoose = module.exports = function(conf) {
  this.conf = conf;
  this.store = App.store(conf.store.name);
  
  var Schema = require('mongoose').Schema;
  this.sessions = this.store.model(conf.store.prefix, new Schema({
    data: Schema.Types.Mixed
  }));
}

Mongoose.prototype.read = function(id, callback) {
  this.sessions.findById(id, function(error, doc) {
    if (error) {
      return callback(error);
    }

    callback(null, doc ? doc.data : {});
  });
}

Mongoose.prototype.write = Mongoose.prototype.save = function(id, data, callback) {
  this.sessions.findByIdAndUpdate(id, { $set: { data: data } }, { upsert: true }, callback);
}

Mongoose.prototype.delete = function(id, callback) {
  this.sessions.findByIdAndRemove(id, callback);
}
