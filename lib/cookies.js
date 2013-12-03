var Cookies = require('cookies');
var Keygrip = require('keygrip');

var conf = App.get('cookies');
if (!conf.sign) {
  conf.sign = {
    keys: [],
    hmac: 'sha1',
    encoding: 'base64'
  }
}

var keys = new Keygrip(conf.sign.keys || [], conf.sign.hmac || 'sha1', conf.sign.encoding || 'base64');

var set = Cookies.prototype.set;
Cookies.prototype.set = function(name, value, options) {
  if (options) {
    for (var key in conf) { options[key] = conf[key]; }
  } else {
    options = conf;
  }

  return set.call(this, name, value, options);
}

Cookies.prototype.delete = Cookies.prototype.remove = function(name) {
  this.set(name, null);
}

App.use(function(request, response, next) {
  request.cookies = response.cookies = new Cookies(request, response, keys);

  next();
});
