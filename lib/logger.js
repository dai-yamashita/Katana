var Winston = require('winston');
var conf    = App.get('logger');
var merge   = require('./utils').merge;

conf = merge({
  padLevels: true,
  levels: null,
  colors: {
    verbose: 'magenta'
  },

  transports: {
    Console: {
      level: 'debug',
      colorize: true
    }
  }
}, conf || {});

var transports = Object.map(conf.transports, function(name, options) {
  return [name, new (Winston.transports[name])(options)];
});

conf.transports = [];
Object.keys(transports).forEach(function(name) {
  conf.transports.push(transports[name]);
});

var Logger = new (Winston.Logger)(conf);

Logger.on('error', function(error) {
  console.error('Logger:', error);
});

module.exports = Logger;
