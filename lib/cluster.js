var Path = require('path');
var Fs   = require('fs');

var EventEmitter = require('events').EventEmitter;

var cluster = require('cluster');

var root  = process.cwd() + Path.sep;
var cores = require('os').cpus().length;

var options = {};

cluster.setMaxListeners(100);
cluster.__proto__.__defineGetter__('size', function() {
  return Object.keys(this.workers).length;
});

module.exports = {
  __proto__: EventEmitter.prototype,

  options: {
    script: root +'app.js',
    workers: cores,
    env: null,
    args: [],
    workon: 'online',
    silent: true,
    signals: true,
    respawn: true,
    respawnTimeout: 2000,
    repl: false,
    forceTimeout: 5000
  },

  danger:     false,
  restarting: false,
  quitting:   false,

  start: function(conf, callback) {
    if (typeof(conf) === 'function') {
      callback = conf; conf = {};
    }

    this.options = options = conf;
    this.set(options);

    if (!Fs.existsSync(options.script)) {
      console.error('  Error:', 'script doesn\'t exists!');
      process.exit(1);
    }

    cluster.setupMaster({
      exec:   options.script,
      env:    options.env,
      args:   options.args,
      silent: options.silent
    });

    options.signals && this.setupSignals();
    cluster.on('fork', this.onWorkerFork.bind(this));

    this.resize(callback.bind(this));
  },

  onWorkerFork: function(worker) {
    var self = this;

    console.log('Worker', worker.id, options.workon);

    worker.birth = Date.now();
    worker.pid   = worker.process.pid;
    worker.__proto__.__defineGetter__('lifetime', function() {
      return (Date.now() - this.birth);
    });

    var timer = null;
    worker.on('disconnect', function() {
      timer = setTimeout(function() {
        worker.process.kill('SIGKILL');
      }, options.forceTimeout);
    });

    worker.on('exit', function() {
      clearTimeout(timer);
 
      if (!worker.suicide) {
        console.log('Worker', worker.id, 'exited abnormally');
        if (worker.lifetime < options.respawnTimeout) {
          console.log('Worker', worker.id, 'died too quickly!');
          self.danger = true;
          return setTimeout(self.resize.bind(self), 2000);
        }
      }

      (cluster.size < options.workers && options.respawn && !self.resizing && !self.restarting) && self.resize();
    });
  },

  completeResize: function(callback) {
    this.resizing = false;

    if (options.workers !== cluster.size) {
      if (this.danger && !options.workers) {
        console.log('danger exit');
        process.exit(1);
      } else {
        this.danger = true;
        setTimeout(this.resize(this), 1000);
      }
    } else { this.danger = false; }

    callback && callback();
  },

  resize: function(size, callback) {
    if (typeof(size) === 'function') {
      callback = size; size = options.workers;
    }

    if (this.resizing) { return; }

    (size >= 0) && (options.workers = size);

    var keys    = Object.keys(cluster.workers);
    var request = options.workers - keys.length;
    var action  = request > 0 ? options.workon : 'exit';
    var count   = request = request > 0 ? request : -request;

    if (options.workers === keys.length) {
      this.resizing = false;

      return this.completeResize(callback);
    }

    var self = this;
    function checkComplete(worker) {
      if (!--request) {
        self.resizing = false;
        cluster.removeListener(action, checkComplete);
        self.completeResize(callback);
      }
    }

    cluster.on(action, checkComplete);

    while(count--) {
      if (action !== 'exit') {
        cluster.fork(options.env);
      } else {
        var worker = cluster.workers[keys[count]];
        if (worker && worker.process.connected) {
          worker.disconnect();
        }
      }
    }
  },

  restart: function(grace, callback) {
    if (this.restarting) { return; }
    if (typeof(grace) === 'function') {
      callback = grace; grace = false;
    }

    var self = this;
    var size = this.size;

    self.restarting = true;

    if (!grace) {
      return self.resize(0, function() {
        self.resize(size, function() {
          self.restarting = false;
          callback && callback();
        });
      });
    }

    var keys  = Object.keys(cluster.workers);

    function next() {
      var worker = cluster.workers[keys.shift()];

      worker.once('exit', function() {
        cluster.fork(options.env);
      });

      cluster.once(options.workon, function(work) {
        if (keys.length) {
          next();
        } else {
          self.restarting = false;
          callback && callback();
        }
      });

      worker.disconnect();
    }

    next();
  },

  quit: function() {
    if (this.quitting) {
      console.log('forceful shutdown!');
      Object.keys(cluster.workers).forEach(function(id) {
        var worker = cluster.workers[id];
        worker && worker.process && worker.process.kill('SIGKILL');
      });
      process.exit(1);
    }

    console.log('graceful shutdown');
    this.quitting = true;
    this.resize(0, function() {
      console.log('cluster graceful shutdown complete');
    });
  },

  quitHard: function() {
    if (this.quitting) { return; }

    this.quitting = true;
    this.quit();
  },

  setupSignals: function() {
    var self = this;

    try {
      process.on('SIGINT', this.quit.bind(this));
      process.on('SIGHUP', this.restart.bind(this));
      process.on('SIGUSR2', function() {
        self.restart(true);
      });
    } catch(error) {
      // Windows must dieeee!
    }

    if (process.platform === 'win32') {
      var readline = require('readline').createInterface({
        input:  process.stdin,
        output: process.stdout
      });

      readline.on('SIGINT', function() {
        process.emit('SIGINT');
      });
    }

    // process.on('exit', this.quitHard.bind(this));
  },

  set: function(conf) {
    conf = conf || {};

    var key = null;
    for(key in conf) {
      options[key] = conf[key];
    }
  },

  get size() {
    return cluster.size;
  }
}
