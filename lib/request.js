var Http = require('http');

var mime = require('mime');

var utils       = require('./utils');
var parseRange  = utils.parseRange;
var parseRanges = utils.parseRanges;
var fresh       = utils.fresh;

var request = module.exports = {
	__proto__: Http.IncomingMessage.prototype
};

request.__defineGetter__('res', function() {
	return this.response;
});

request.__defineGetter__('module', function() {
	return this.route ? this.route.module : undefined;
});

request.__defineGetter__('directory', function() {
	return this.route ? this.route.directory : undefined;
});

request.__defineGetter__('dir', function() {
	return this.route ? this.route.directory : undefined;
});

request.__defineGetter__('controller', function() {
	return this.route ? this.route.controller : undefined;
});

request.__defineGetter__('action', function() {
	return this.route ? this.route.action : undefined;
});

request.__defineGetter__('arguments', function() {
	return this.route ? this.route.arguments : undefined;
});

request.__defineGetter__('params', function() {
	return this.route ? this.route.params : undefined;
});

request.__defineGetter__('routedUrl', function() {
	return this.route ? this.route.routed : undefined;
});

request.__defineGetter__('body', function() {
	return this.data;
});

request.__defineSetter__('body', function(value) {
	return this.data = value;
});

request.data  = {};
request.files = {};

request.get = request.header = function(name) {
  name = name.toLowerCase();
  if (name==='referer' || name==='referrer') {
  	return (this.headers.referrer || this.headers.referer);
  }

  return this.headers[name];
}

request.accepts = function(type) {
	var args = arguments.length > 1 ? [].slice.apply(arguments) : type;

	return utils.accepts(args, this.get('accept'));
}

request.acceptsEncoding = function(encoding) {
	return !!~this.acceptedEncodings.indexOf(encoding);
}

request.acceptsCharset = function(charset) {
	var accepted = this.acceptedCharsets;

	return accepted.length ? !!~accepted.indexOf(charset) : true;
}

request.acceptsLanguage = function(lang) {
	var accepted = this.acceptedLanguages;

	return accepted.length ? !!~accepted.indexOf(lang) : true;
}

// TODO: cache parsed range in _ranges?
request.__defineGetter__('ranges', function() {
	var range = this.get('range');

	// return this._ranges || (this._ranges = parseRanges(range));
	return parseRanges(range);
});

request.range = function(size) {
	var range = this.get('range');

	if (range) {
		return parseRange(size, range);
	}
}

request.__defineGetter__('acceptedEncodings', function() {
	var accept = this.get('accept-encoding');

	return accept ? accept.trim().split(/ *, */) : [];
});

request.__defineGetter__('accepted', function() {
	var accept = this.get('accept');

	return accept ? utils.parseAccept(accept) : [];
});

request.__defineGetter__('acceptedLanguages', function() {
	var accept = this.get('accept-language');

	return accept ? utils.parseParams(accept).map(function(obj) { return obj.value; }) : [];
});

request.__defineGetter__('acceptedCharsets', function() {
	var accept = this.get('accept-charset');

	return accept ? utils.parseParams(accept).map(function(obj) { return obj.value; }) : [];
});

request.param = function(name, defaultValue) {
	var params = this.params || {};
	var data   = this.data || {};
	var query  = this.query || {};

	if (params[name] != null && params.hasOwnProperty(name)) { return params[name]; }
	if (data[name]) { return data[name]; }
	if (query[name]) { return query[name]; }

	return defaultValue;
}

request.is = function(type) {
	var ct = this.get('content-type');

	if (!ct) { return false; }

	ct = ct.split(';')[0];

	if (!~type.indexOf('/')) { type = mime.lookup(type); }
	if (~type.indexOf('*')) {
		type = type.split('/');
		ct   = ct.split('/');

		if (type[0]==='*' && type[1]===ct[1]) { return true; }
		if (type[1]==='*' && type[0]===ct[0]) { return true; }

		return false;
	}

	return !!~ct.indexOf(type);
}

request.__defineGetter__('protocol', function() {
	var trustProxy = App.get('trustProxy');

	if (this.connection.encrypted) { return 'https'; }
	if (!trustProxy) { return 'http'; }

	var proto = this.get('x-forwarded-proto') || 'http';

	return proto.split(/\s*,\s*/)[0];
});

request.__defineGetter__('secure', function() {
	return this.protocol === 'https';
});

request.__defineGetter__('ip', function() {
	return this.ips[0] || this.connection.remoteAddress;
});

request.__defineGetter__('ips', function() {
	var trustProxy = App.get('trustProxy');
	var val = this.get('x-forwarded-for');

	return (trustProxy && val) ? val.split(/ *, */) : [];
});

request.__defineGetter__('auth', function() {
	var auth = this.get('authorization');

	if (!auth) { return; }

	var parts = auth.split(' ');
	
	if (parts[0].toLowerCase() !== 'basic') { return; }
	if (!parts[1]) { return; }

	auth = parts[1];

	if (!(auth = new Buffer(auth, 'base64').toString().match(/^([^:]*):(.*)$/))) { return; }

	return { username: auth[1], password: auth[2] };
});

request.__defineGetter__('subdomains', function() {
	var offset = App.get('subdomain offset') || 2;

	return (this.host || '').split('.').reverse().slice(offset);
});

request.__defineGetter__('host', function() {
	var trustProxy = App.get('trustProxy');
	var host = trustProxy && this.get('x-forwarded-host');

	host = host || this.get('host');

	return host ? host.split(':')[0] : undefined;
});

request.__defineGetter__('fresh', function() {
	var method = this.method;
	var status = this.response.statusCode;

	if (method === 'GET' || method === 'HEAD') {
		if ((status >= 200 && status < 300) || status === 304) {
			return fresh(this.headers, this.response._headers);
		}
	}

	return false;
});

request.__defineGetter__('stale', function() {
	return !this.fresh;
});

request.__defineGetter__('xhr', function() {
	var val = this.get('x-requested-with') || '';

	return (val.toLowerCase() === 'xmlhttprequest');
});

request.__defineGetter__('ajax', function() {
	return this.xhr;
});
