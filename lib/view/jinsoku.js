var extend = require('../utils').extend;

var Config = require('../config')().view;

require('./engine');

Class('Katana.Core.View.Jinsoku', {
  does: Katana.Core.View.Engine,
	
  have: {
	jinsoku: null,
	compiled: {}
  },
	
  methods: {
	initialize: function() {
	  var self = this;
			
	  self.jinsoku = require('jinsoku');
			
	  this.jinsoku.template = function(template, callback) {
		template = template.replace('.', '/');
				
		var module = 'application';

		if (m = template.match(/(.*)\:(.*)/i)) {
		  module   = m[1];
		  template = m[2];
		}
			
		if (App.View.views[module] && App.View.views[module][template]) {
		  callback(App.View.views[module][template]);
		} else {
		  callback('');
		}
	  }
	},
		
	render: function(template, data, callback) {
	  var self = this;
	  data = data || {};
			
	  data = extend(self.data, data);
			
	  var content;
			
	  if (typeof(self.compiled[template]) == 'function') {
		content = self.compiled[template](data);
				
		callback && callback(content);
				
		return content;
	  }
			
	  self.jinsoku.compile(template, function(fn) {
	    self.compiled[template] = fn;
				
		content = fn(data);
				
		callback && callback(content);
	  });
			
	  return content;
	}
  }
});

module.exports = Katana.Core.View.Jinsoku;
