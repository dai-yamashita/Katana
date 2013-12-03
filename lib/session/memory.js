var Memory = module.exports = function(conf) {
	this.conf = conf;
	this.store = App.store(conf.store.name);
}

Memory.prototype.read = function(id, callback) {
	callback(null, this.store.get(this.conf.store.prefix +':'+ id) || {});
}

Memory.prototype.write = Memory.prototype.save = function(id, data, callback) {
	this.store.set(this.conf.store.prefix +':'+ id, data);

	callback(null, data);
}

Memory.prototype.delete = function(id, callback) {
  this.store.delete(id);

  callback();
}
