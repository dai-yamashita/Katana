var extend = require('../utils').extend;

var config = require('../config')().view;

var Jade = require('jade');

require('./engine');

Class('Katana.Core.View.Jade', {
  does: Katana.Core.View.Engine,
	
  have: {
 	jade: null
  },
	
  methods: {
	initialize: function() {
	  this.jade = Jade;
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
		var fn = this.jade.compile(this.views[module][template], config.options || {});
				
		return fn(data);
	  } else {
		// handle no view exception...
		return '';
	  }
	}
  }
});

module.exports = Katana.Core.View.Jade;

Jade.Parser.prototype.parseInclude = function() {
  var template = this.expect('include').val.trim();
	
  var module = 'application';
	
  var non_jade = template[0] == '#';
	
  if (non_jade) {
	template = template.substr(1);
  }
	
  if (m = template.match(/(.*)\:(.*)/i)) {
	module   = m[1];
	template = m[2];
  }
	
  if (global.App.View.views[module][template] === undefined) {
 	throw new Error('Template '+ template +' for module '+ module +' does not exists!');
  }
	
  if (non_jade) {
 	return new Jade.nodes.Literal(global.App.View.views[module][template]);
  }
	
  var parser = new Jade.Parser(global.App.View.views[module][template], module +':'+ template, this.options);

  parser.blocks = this.blocks;
  parser.mixins = this.mixins;

  this.context(parser);

  var result = parser.parse();

  this.context();

  result.filename = module +':'+ template;

  if (this.peek().type == 'indent') {
    result.includeBlock().push(this.block());
  }

  return result;
}

Jade.Parser.prototype.parseExtends = function() {
  var template = this.expect('extends').val.trim();
	
  var module = 'application';
	
  if (m = template.match(/(.*)\:(.*)/i)) {
	module   = m[1];
	template = m[2];
  }
	
  if (global.App.View.views[module][template] === undefined) {
	throw new Error('Template '+ template +' for module '+ module +' does not exists!');
  }
	
  var parser = new Jade.Parser(global.App.View.views[module][template], module +':'+ template, this.options);
	
  parser.blocks = this.blocks;
  parser.contexts = this.contexts;

  this.extending = parser;

  return new Jade.nodes.Literal('');
}

Jade.runtime.rethrow = function(err, filename, lineno){
  if (!filename) throw err;

  var module = 'application';
	
  if (m = filename.match(/(.*)\:(.*)/i)) {
	module   = m[1];
	template = m[2];
  }

  var context = 3
    , str = global.App.View.views[module][template]
    , lines = str.split('\n')
    , start = Math.max(lineno - context, 0)
    , end = Math.min(lines.length, lineno + context);

  // Error context
  var context = lines.slice(start, end).map(function(line, i){
    var curr = i + start + 1;
    return (curr == lineno ? '  > ' : '    ')
      + curr
      + '| '
      + line;
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'Jade') + ':' + lineno
    + '\n' + context + '\n\n' + err.message;
  throw err;
}
