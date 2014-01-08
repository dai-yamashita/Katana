require('joose');
require('katana');

process.title = 'Node: '+ App.info.name;

App.use(function(request, response, next) {
  response.setHeader('X-Powered-By', 'Katana v'+ App.version);

  next();
});
