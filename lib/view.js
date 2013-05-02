var consolidate = require('consolidate');

var options = require('./config')().view;
var extend  = require('./utils').extend;

module.exports = {
  data: options,

  render: function(template, data, callback) {
    template = template.replace('.', '/');

    if (typeof(data) === 'function') {
      callback = data;
      data = {};
    }

    var data = extend(this.data, data);

    var module = 'application';

    if (exp = template.match(/(.*)\:(.*)/i)) {
      module = exp[1];
      template = exp[2];
    }

    var path = root + module +'/views/'+ template + (data.extension || '');

    consolidate[data.engine](path, data, callback);
  },

  set: function(key, value) {
    if (typeof(key) === 'object') {
      return this.data = extend(this.data, key);
    }

    this.data[key] = value;
  }
}
