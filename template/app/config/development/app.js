var Path = require('path');
var Fs   = require('fs');

module.exports = {
  url: 'localhost',

  http: {
    host: '127.0.0.1',
    port: 8000
  },

  https: false,
  // https: {
  //   host: '127.0.0.1',
  //   port: 1443,
  //   key:  Fs.readFileSync(App.root + 'server.key'),
  //   cert: Fs.readFileSync(App.root + 'server.crt'),
  //   ca:   null
  // },

  trustProxy: false,
  etag: true,
  domain: { offset: 2 },

  json: {
    replacer: null,
    spaces: 2
  },

  jsonp: {
    callback: ['jsonp', 'callback']
  },

  favicon: 'public/images/favicon.ico',

  logger: {
    padLevels: true,
    transports: {
      Console: {
        level: 'debug',
        colorize: true
      }
    }
  },
  
  view: {
    engine: 'ejs',
    cache: true,
    extension: '.html',
    open: '<?',
    close: '?>',
    resolve: true
  },
  
  cookies: {
    enabled: false,

    path: '/',
    expires: undefined,
    domain: undefined,
    httpOnly: true,
    secure: false,
    overwrite: false,

    // sign: {
    //   keys: ['...'],
    //   hmac: 'sha1',
    //   encoding: 'base64'
    // },
    sign: false
  },

  session: {
    enabled: false,

    store: {
      name: 'memory',
      prefix: 'session'
    },

    key: {
      name: 'session',
      length: 24
    },

    expires: 1000 * 60 * 60 * 24 * 7,
    defaults: {}
  },
  
  multiparser: {
    enabled: true,

    maxFields: 1000,
    maxFieldsSize: 2 * 1024 * 1024,
    uploadDir: Path.join(App.root, 'temp', 'files'),
    keepExtensions: false,
    encoding: 'utf-8',

    waitEnd: true
  },
  
  statics: {
    enabled: true,
    
    path: 'public',
    cache: 7200,
    serverInfo: null,
    headers: {},
    gzip: false
  }
}
