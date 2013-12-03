var sanitize = require('./utils').sanitize;

var conf  = App.get(':routing');
var verbs = conf.methods.join('|').toLowerCase();
var cache = conf.cache;

var router = module.exports = {
  routes: {}
};

router.prepare = function(rules, module) {
  var self = this;

  self.routes[module] = {};

  for (var i=0; i<rules.length; i++) {
  	var rule = rules[i][0];
  	var path = rules[i][1];
  	var method = '*';

  	var match = null;

    if (rule !=='*' && (match = rule.match(new RegExp('^((?:(?:'+ verbs +')\\|?)*)*\\s*(.*)$', 'i')))) {
      method = (!match[1] || match[1]==='*') ? '*' : match[1];
      rule = match[2];
    }

    var keys = [];
    var regexp = self.normalize(rule, keys);

    var moduleRule = self.routes[module];

    var methods = method.split('|');
    methods.forEach(function(method) {
      !moduleRule[method] && (moduleRule[method] = []);
      moduleRule[method].push({
        regexp: regexp,
        path: sanitize(path).trim('\\s\/'),
        keys: keys
      });
    });
  }
}

router.normalize = function(rule, keys) {
	var index = 0;

	if (rule instanceof RegExp) {
		var k = rule.source.match(/\(.*?\)/g)

		for (; index<k.length ;) {
			keys.push({ name: ++index });
		}

		return rule;
	}

	// rule = sanitize(rule).trim('\\s\/')
	rule = rule
	  .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star) {
      keys.push({ name: key || ++index, optional: !!optional });
      slash = slash || '';
      return ''
        + (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : '');
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');

   return new RegExp('^'+ rule +'$', 'i');
}

App._modules.forEach(function(module) {
	router.prepare(App.get(module +':routing routes') || [], module);
});

// TODO: try to deal with optional params
router.route = function(uri, method, module, useRoutes) {
	var self = this;

	module = module || 'app';
	method = method || 'GET';
	useRoutes===undefined && (useRoutes = true);

	var routed = uri;

	var conf = App.get((module) +':routing') || {};
	conf.route || (conf.route = {});

	var route = {
		module:     module,
		directory:  conf.route.directory || '',
		controller: conf.route.controller || (module==='app' ? 'home' : module),
		action:     conf.route.action || 'index',
		arguments:  conf.route.arguments || [],
		params:     conf.route.params || {},
		routed:     routed
	}

	var found = false;
	var mod = null;

	if (useRoutes) {
		[method.toLowerCase(), '*'].forEach(function(method) {
			var rules = self.routes[module][method];

			if (!found && rules) {
				for (var i=0; i<rules.length; i++) {
					var rule  = rules[i];
					var match = null;

					if (match = uri.match(rule.regexp)) {
						found  = true;
						match  = match.slice(1);
						routed = rule.path;

						for (var j=0; j<match.length; j++) {
							var key = rule.keys[j];
							var name = key ? key.name : j+1;

							route.params[name] = match[j];
							routed = routed.replace(':'+ name, match[j] || '');
						}

						if (route.module==='app' && (mod = routed[0]==='#')) {
							routed = routed.substr(1);
						}

						// remove optional params
						// routed = routed.replace(/\/?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/, '');

						// TODO: find a better way to set controller directory
						routed = routed.replace(/\[(.*)\](\/)?/, function(_, dir) {
							route.directory = sanitize(dir.toLowerCase()).trim('\\s\/') + '/';

							// TODO: keep directory in routed path for module re-routing?
							// return route.directory;
							return '';
						});

            route.routed = routed;

						break;
					}
				}
			}
		});
	}

	var segments = routed.indexOf('/') !== -1 ? routed.split('/') : [routed];

	if (segments.length && mod) {
		route.module = segments.shift().toLowerCase();
		route.routed = route.routed.replace(new RegExp('^'+ route.module +'[\/]?', 'i'), '');
	}

	segments.length && (route.controller = segments.shift().toLowerCase() || (module==='app' ? 'home' : module));
	segments.length && (route.action     = segments.shift().toLowerCase());
	segments.length && (route.arguments  = segments);

	return route;
}
