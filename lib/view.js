var Consolidate = require('./consolidate');

var merge = App.utils.merge;

var conf = App.get('view');

var view = module.exports = {
  conf: conf,
  data: conf,
  engine: require(conf.engine)
};

view.engine.resolve = function(path) {
  var module = 'app';
  var match  = null;

  path = path.trim().replace(/\s+|\./g, '/');

  if (match = path.match(/(.*)\:(.*)/)) {
    module = match[1];
    path   = match[2].trim();
  }

  return (App.root + (module==='app' ? 'app/views/' : 'modules/'+ module +'/views/') + path);
}

view.set = function(key, value) {
  if (typeof(key) === 'object') {
    return this.data = merge(this.data, key);
  }

  return (this.data[key] = value);
}

view.render = function(path, data, callback) {
  if (typeof(data) === 'function') {
    callback = data;
    data = {};
  }

  data = merge(this.data, data);
  path = (data.resolve !== false ? this.engine.resolve(path) : path) + (data.extension || '');

  Consolidate[data.engine](path, data, callback || function(error, content) {
    if (error) {
      throw error;
    }
  });
}
