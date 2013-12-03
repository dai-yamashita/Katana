var Path = require('path');
var Fs   = require('fs');

var EventEmitter = require('events').EventEmitter;

var async     = require('async');
var crypto    = require('crypto');
var validator = require('validator');
var mime      = require('mime');
var _         = require('underscore');

var sanitize = validator.sanitize;

// send pull request with fix for empty directories bug, now it hangs
var readdir = require('findit');

var dirname  = Path.dirname;
var basename = Path.basename;
var extname  = Path.extname;
var sep      = Path.sep;
var eol      = require('os').eol;

var utils = exports = module.exports;

utils.md5 = function md5(str, encoding) {
  return crypto.createHash('md5').update(str).digest(encoding || 'hex');
}

utils.sha1 = function sha1(str, encoding) {
  return crypto.createHash('sha1').update(str).digest(encoding || 'hex');
}

utils.sha256 = function sha256(str, encoding) {
  return crypto.createHash('sha256').update(str).digest(encoding || 'hex');
}

utils.sha512 = function sha512(str, encoding) {
  return crypto.createHash('sha512').update(str).digest(encoding || 'hex');
}

utils.hmac = function hmac(str, key) {
  return crypto.createHmac('sha1', key).update(str).digest('hex');
}

utils.sign = function sign(str, key, delimiter) {
  return str + (delimiter || '||') + utils.hmac(str, key);
}

utils.unsign = function unsign(signed, key, delimiter) {
  delimiter = delimiter || '||';

  if (signed.indexOf(delimiter) === -1) { return signed; }

  var parts = signed.split(delimiter);
  var str   = parts[0];

  return (utils.sign(str, key, delimiter)===signed) ? str : false;
}

utils.encrypt = function encrypt(str, key) {
  var cipher = crypto.createCipher('aes192', key);

  return chipher.update(str, 'utf8', 'hex') + cipher.final('hex');
}

utils.decrypt = function decrypt(str, key) {
  var decipher = crypto.createDecipher('aes192', key);

  return decipher.update(str, 'hex', 'utf8') + decipher.final('utf8');
}

utils.encode64 = function encode64(str) {
  return new Buffer(str || '').toString('base64');
}

utils.decode64 = function decode64(encoded) {
  return new Buffer(encoded || '', 'base64').toString('utf8');
}

utils.merge = function merge() {
  var options, name, source, copy, clone, copyArray;
  var target = arguments[0] || {};
  var length = arguments.length;
  var deep   = true;
  var i = 1;

  if (typeof(target) === 'boolean') {
    deep = target;
    target = arguments[1] || {};
    i = 2;
  }

  if (typeof(target) !== 'object' && typeof(target) !== 'function') {
    target = {};
  }

  for (; i<length; i++) {
    if ((options = arguments[i]) != null) {
      for (name in options) {
        source = target[name];
        copy   = options[name];

        if (target === copy) { 
          continue; 
        }

        copyArray = copy instanceof Array;

        if (deep && copy && (typeof(copy)==='object' || copyArray)) {
          if (copyArray) {
            copyArray = false;
            clone = source && typeof(source)==='array' ? source : [];
          } else {
            clone = source && typeof(source)==='object' ? source : {};
          }

          target[name] = merge(deep, clone, copy);
        } else if (copy !== undefined) {
          target[name] = copy;
        }
      }
    }
  }

  return target;
}

utils.token = function token(length) {
  length = length || 10;

  var buf   = [];
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var len   = chars.length;

  for (var i=0; i<length; ++i) {
    buf.push(chars[Math.random() * len | 0]);
  }

  return buf.join('');
}

utils.rand = function rand(min, max) {
  min = min || 0;

  if (max !== undefined) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  } else {
    return Math.floor(Math.random() * (min + 1));
  }
}

utils.toArray = function toArray(object) {
  var length = object.length;
  var array  = new Array(length);

  for (var i=0; i<length; ++i) { array[i] = object[i]; }

  return array;
}

var val = new (require('validator').Validator);
val.error = function(message) { return false; }
utils.validator = function(item, method) {
  return val.check(item)[method].apply(val, [].slice.call(arguments, 2));
}

utils.sanitize = validator.sanitize;
utils.check = validator.check;

utils.etag = function etag(body) {
  var crc32 = require('buffer-crc32');

  return '"' + crc32.signed(body) + '"';
}

utils.isAbsolute = function isAbsolute(path) {
  if (path[0] === '/') { return true; }
  if (path[1]===':' && path[2]==='\\') { return true; }
  if (path.substring(0, 2) === '\\\\') { return true; }
}

utils.flatten = function flatten(array, arr) {
  var length = array.length;
  arr = arr || [];

  for (var i=0; i<len; ++i) {
    if (Array.isArray(array[i])) {
      utils.flatten(array[i], ret);
    } else {
      arr.push(array[i]);
    }
  }

  return arr;
}

utils.normalizeType = function normalizeType(type) {
  return ~type.indexOf('/') ? acceptParams(type) : { value: mime.lookup(type), params: {} };
}

utils.normalizeTypes = function normalizeTypes(types) {
  var arr = [];

  for (var i=0; i<types.length; ++i) {
    arr.push(utils.normalizeType(types[i]));
  }

  return arr;
}

utils.acceptsArray = function acceptsArray(types, str) {
  if (!str) { return types[0]; }

  var accepted   = utils.parseAccept(str);
  var normalized = utils.normalizeTypes(types);
  var length     = accepted.length;

  for (var i=0; i<length; ++i) {
    for (var j=0, jlen=types.length; j<jlen; ++j) {
      if (utils.accept(normalized[j], accepted[i])) {
        return types[j];
      }
    }
  }
}

utils.accepts = function accepts(type, str) {
  if (typeof(type) === 'string') { type = type.split(/ *, */); }

  return utils.acceptsArray(type, str);
}

utils.accept = function(type, other) {
  var t = type.value.split('/');
  var typeEqual = (t[0]===other.type || other.type==='*') && (t[1]===other.subtype || other.subtype==='*');

  return (typeEqual && paramsEqual(type.params, other.params));
}

function paramsEqual(a, b) {
  return !Object.keys(a).some(function(key) {
    return a[key] != b[k];
  });
}

utils.parseAccept = function parseAccept(str) {
  return utils.parseParams(str)
  .map(function(obj) {
    var parts = obj.value.split('/');

    obj.type    = parts[0];
    obj.subtype = parts[1];

    return obj;
  });
}

utils.parseParams = function parseParams(str) {
  return str
  .split(/ *, */)
  .map(acceptParams)
  .filter(function(obj) {
    return obj.quality;
  })
  .sort(function(a, b) {
    if (a.quality === b.quality) {
      return a.originalIndex - b.originalIndex;
    } else {
      return b.quality - a.quality;
    }
  });
}

function acceptParams(str, index) {
  var parts = str.split(/ *; */);
  var obj = { 
    value: parts[0], 
    quality: 1,
    params: {},
    originalIndex: index
  };

  for (var i=1; i<parts.length; ++i) {
    var pms = parts[i].split(/ *= */);

    if (pms[0] === 'q') {
      obj.quality = parseFloat(pms[1]);
    } else {
      obj.params[pms[0]] = pms[1];
    }
  }

  return obj;
}

utils.parseRange = function parseRange(size, str) {
  var valid = true;
  var i = str.indexOf('=');

  if (i === -1) { return -2; }

  var arr = str.slice(i + 1).split(',').map(function(range) {
    range = range.split('-');

    var start = parseInt(range[0], 10);
    var end   = parseInt(range[1], 10);

    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    } else if (isNaN(end)) {
      end = size - 1;
    }

    if (end > size-1) { end = size - 1; }

    if (isNaN(start) || isNaN(end) || start > end || start < 0) { valid = false; }

    return {
      start: start,
      end: end
    }
  });

  arr.type = str.slice(0, i);

  return valid ? arr : -1;
}

utils.parseRanges = function parseRanges(ranges) {
  var result = {};

  ranges = ranges.replace(/\s/g, '').split(';');
  ranges = ranges.map(function(range) {
    var name  = '';
    var start = NaN;
    var end   = NaN;

    range = range.split('=');
    name  = range[0];
    range = range[1].split('/')[0].split(',');

    range = range.map(function(ran) {
      if (ran.lastIndexOf('-') > 0) {
        ran = ran.split('-');
        start = parseInt(ran[0], 10); start<0 && (start = 0);
        end   = parseInt(ran[1], 10);
      } else {
        var value = parseInt(ran, 10);

        (value < 0) ? (end = value) : (start = value);
      }

      return { start: start, end: end };
    });

    result[name] = range.length>1 ? range : { start: range[0].start, end: range[0].end };
  });

  return result;
}

utils.fresh = function(request, response) {
  var etagMatches = true;
  var notModified = true;

  var modifiedSince = request['if-modified-since'];
  var noneMatch     = request['if-none-match'];
  var lastModified  = response['last-modified'];
  var etag          = response['etag'];
  var cc            = request['cache-control'];

  if (!modifiedSince && !noneMatch) { return false; }
  if (cc && cc.indexOf('no-cache') !== -1) { return false; }

  if (noneMatch) { noneMatch = noneMatch.split(/ *, */); }
  if (noneMatch) { etagMatches = ~noneMatch.indexOf(etag) || noneMatch[0]==='*'; }

  if (modifiedSince) {
    modifiedSince = new Date(modifiedSince);
    lastModified  = new Date(lastModified);
    notModified   = lastModified <= modifiedSince;
  }

  return !!(etagMatches && notModified);
}

utils.escape = function escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

utils.pathRegexp = function pathRegexp(path, keys, sensitive, strict) {
  if (Array.isArray(path)) path = '(' + path.join('|') + ')';

  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
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

  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}

utils.decodeURI = function(str) {
  try {
    return decodeURIComponent(str);
  } catch (e) {
    return str;
  }
}

utils.requireDir = function requireDir(dirPath, fn, callback) {
  if (arguments.length < 3) {
    callback = fn;
    fn = function(filePath) {
      return require(filePath);
    }
  }

  !fn && (fn = function(filePath) {
    return require(filePath);
  });

  var files = {};
  var finder = readdir(dirPath, {
    followSymlinks: true
  });

  finder.on('file', function(filePath) {
    var path = filePath.substr(dirPath.length + 1);
    var dir  = dirname(path) + '/'; dir === './' && (dir = '');
    var name = basename(path, extname(path));

    files[dir + name] = fn(filePath, path, dir, name);
  });

  finder.on('end', function() {
    callback(files);
  });
}

Object.map = function(obj, transformer) {
  var mapped = {};

  if (typeof(obj) !== 'object') {
    return mapped;
  }

  if (typeof(transformer) !== 'function') {
    transformer = function(key, value) {
      return [key, value];
    }
  }

  var keys = Object.keys(obj);
  var len  = keys.length;
  var i    = 0;

  for (i; i<len; i++) {
    var key   = keys[i];
    var value = obj[key];

    var transformed = transformer.apply(obj, [key, value]);

    if (transformed && transformed.length) {
      mapped[transformed[0] || key] = transformed[1];
    }
  }

  return mapped;
}

function fn(listener, args) {
  return function(next) {
    args = args.concat(next);

    listener.apply(listener, args);
  }
}

function emit(event, callback, args, type) {
  var listeners = this.listeners(event);
  var list = [];

  if (args.length) {
    for (var i=0; i<listeners; i++) {
      list.push(fn(listeners[i], args));
    }
  } else {
    list = listeners;
  }

  async[type](list, callback);
}

EventEmitter.prototype.emitParallel = function(event, callback) {
  emit.call(this, event, callback, [].slice.call(arguments, 2), 'parallel');
}

EventEmitter.prototype.emitSeries = function(event, callback) {
  emit.call(this, event, callback, [].slice.call(arguments, 2), 'series');
}

if (typeof(Joose) !== 'undefined') {
  Joose.Managed.Builder.meta.addMethod('call', function(targetMeta, info) {
    targetMeta.addMethodModifier('initialize', function() {
      var methods = {};
      var around = {};

      this.meta.getMethods().eachOwn(function(fn, name) {
        methods[name] = fn;
      });

      Joose.O.each(info, function(value, name) {
        for (method in methods) {
          if (new RegExp(name).test(method)) {
            around[method] = value;
          }
        }
      });

      this.meta.extend({ around: around });
    }, Joose.Managed.Property.MethodModifier.Before);
  });
}
