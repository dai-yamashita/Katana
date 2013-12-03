var Formidable = require('formidable');

var conf = App.get('multiparser');

App.use(function(request, response, next) {
  if (['GET', 'HEAD', 'OPTIONS', 'TRACE'].indexOf(request.method) !== -1) {
    return next();
  }

  var form = request.form = new Formidable.IncomingForm(conf);

  form.on('field', function(name, value) {
    onData(name, value, request.data);
  }).on('file', function(name, file) {
    onData(name, file, request.files);
  }).on('error', function(error) {
    conf.waitEnd ? next(error) : console.log(error);
  }).on('end', function() {
    conf.waitEnd && next();
  }).parse(request);

  !conf.waitEnd && next();
});

function onData(name, value, data) {
  if (Array.isArray(data[name])) {
    data[name].push(value);
  } else if (data[name]) {
    data[name] = [data[name], value];
  } else {
    data[name] = value;
  }
}
