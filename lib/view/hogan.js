var root = global.root;

var extend = require('../utils').extend;

var config = require('../config')().view;

var Hogan = require('hogan.js');

require('./engine');
require('joose');

Class('Katana.Core.View.Hogan', {
	does: Katana.Core.View.Engine,
	
	have: {
		ejs: null
	},
	
	methods: {
		initialize: function() {
			this.hogan = Hogan;
		},
		
		render: function(template, data) {
			template = template.replace('.', '/');
			data = data || {};
			
			var module = 'application';
			
			if (m = template.match(/(.*)\:(.*)/i)) {
				module   = m[1];
				template = m[2];
			}
			
			data = extend(this.data, data);
			
			if (this.views[module] && this.views[module][template]) {
				var templ = Hogan.compile(this.views[module][template], config.options);
				
				return templ.render(data);
			} else {
				// handle no view exception...
				return '';
			}
		}
	}
});

module.exports = Katana.Core.View.Hogan;


