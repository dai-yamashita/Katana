var Config = require('../config')().view;

var ViewEngine = require('./' + Config.engine);

Class('Katana.Core.View', {
  isa: ViewEngine,

  have: {
		
  },

  methods: {
	initialize: function() {
	  this.SUPER();
			
	  this.set('View', this);
	}
  }
});

module.exports = new Katana.Core.View;
