var Path = require('path');
var Fs   = require('fs');

var async = require('async');

var join      = Path.join;
var normalize = Path.normalize;
var dirname   = Path.dirname;
var basename  = Path.basename;
var extension = Path.extname;

var sep = Path.sep;

// https://github.com/nodeca/fs-tools/blob/master/lib/fs-tools.js
var utils = module.exports;

utils.walkFlat = function(path, iterator, callback) {
  Fs.readdir(path, function(error, files) {
    if (error) {
      return callback(error.code==='ENOENT' ? null : error);
    }

    async.forEach(files, function(file, next) {
      iterator(join(path, file), next);
    }, callback);
  });
}

utils.walkDeep = function(path, match, iterator, callback) {
  utils.walkFlat(normalize(path), function(path, next) {
    Fs.lstat(path, function(error, stats) {
      if (error) {
        return next(error);
      }

      if (match(path, stats)) {
        if (stats.isDirectory()) {
          iterator(path, stats, function() {
            utils.walkDeep(path, match, iterator, next);
          });
        } else {
          iterator(path, stats, next);
        }

        return;
      }

      next();
    });
  }, callback);
}

utils.copyFile = function(source, destination, callback) {
  var _done = false;
  function done() {
    if (!_done) {
      _done = true; callback.apply(callback, arguments);
    }
  }

  var read  = Fs.createReadStream(source, { bufferSize: 64 * 1024 }).on('error', done);
  var write = Fs.createWriteStream(destination).on('error', done).on('close', done);

  read.pipe(write);
}

utils.walk = function(path, pattern, iterator, callback) {
  if (!callback) {
    callback = iterator; iterator = pattern; pattern = null;
  }

  if (!pattern) {
    var match = function() { return true; }
  } else if (typeof(pattern) === 'function') {
    var match = pattern;
  } else {
    pattern = new RegExp(pattern);
    var match = function(path) { return pattern.test(path); }
  }

  path = normalize(path);

  Fs.lstat(path, function(error, stats) {
    if (error) {
      return callback(error.code==='ENOENT' ? null : error);
    }

    if (!stats.isDirectory()) {
      return callback(new Error('Path is not a directory!'));
    }

    utils.walkDeep(path, match, iterator, callback);
  });
}

utils.remove = function(path, callback) {
  path = normalize(path);

  Fs.lstat(path, function(error, stats) {
    if (error) {
      return callback(error.code==='ENOENT' ? null : error);
    }

    if (!stats.isDirectory()) {
      return Fs.unlink(path, callback);
    }

    async.series([
      async.apply(utils.walkFlat, path, utils.remove),
      async.apply(Fs.rmdir, path)
    ], function(error) {
      callback(error);
    });
  });
}

utils.mkdir = function(path, mode, callback) {
  path = normalize(path);

  if (typeof(mode) === 'function') {
    callback = mode; mode = 0755;
  } else if (typeof(mode) === 'string') {
    mode = parseInt(mode, 8);
  }

  Fs.exists(path, function(exists) {
    if (exists) {
      return callback();
    }

    var parent = dirname(path);

    utils.mkdir(parent, mode, function(error) {
      if (error) {
        return callback(error);
      }

      Fs.mkdir(path, mode, function(error) {
        if (error && error.code==='EEXIST') {
          return callback();
        }

        callback(error);
      });
    });
  });
}

utils.copy = function(source, destination, callback) {
  source      = normalize(source);
  destination = normalize(destination);

  if (source === destination) {
    return callback();
  }

  Fs.lstat(source, function(error, stats) {
    if (error) {
      return callback(error);
    }

    utils.mkdir(dirname(destination), function(error) {
      if (error) {
        return callback(error);
      }

      var chmod = async.apply(Fs.chmod, destination, stats.mode);
      var done  = function(error) { callback(error); }

      if (stats.isFile()) {
        return async.series([async.apply(utils.copyFile, source, destination), chmod], done);
      }

      if (stats.isSymbolicLink()) {
        return async.waterfall([
          function(next) {
            Fs.exists(destination, function(exists) {
              if (exists) {
                return utils.remove(destination, next);
              }

              next();
            });
          },
          async.apply(Fs.readlink, source),
          function(path, next) {
            Fs.symlink(path, destination, next);
          },
          chmod
        ], done);
      }

      if (stats.isDirectory()) {
        return async.series([
          function(next) {
            Fs.mkdir(destination, 0755, function(error) {
              if (error && error.code==='EEXISTS') {
                return next();
              }

              next(error);
            });
          },
          async.apply(utils.walkFlat, source, function(path, next) {
            utils.copy(path, destination + sep + path.replace(source, ''), next);
          }),
          chmod
        ], done);
      }

      callback(new Error('Unsupported type of the source'));
    });
  });
}

utils.move = function(source, destination, callback) {
  Fs.rename(source, destination, function(error) {
    if (!error) {
      return callback();
    }

    async.series([
      async.apply(utils.copy, source, destination),
      async.apply(utils.remove, source)
    ], function(error) {
      callback(error);
    });
  });
}

utils.find = function(path, options, callback) {
  var files = [];

  if (!callback) {
    callback = options; options = {};
  }

  if (typeof(options) === 'function') {
    options = {
      pattern: options
    };
  }

  options.filesOnly===undefined && (options.filesOnly = true);
  options.hiddens===undefined && (options.hiddens = false);

  utils.walk(path, options.pattern, function(file, stats, next) {
    if (options.filesOnly && stats.isDirectory()) {
      return next();
    }

    var name = basename(file, extension(file));
    if (!options.hiddens && (!name || name[0]==='.')) {
      return next();
    }

    files.push(file);

    next();
  }, function(error) {
    callback(error, files);
  });
}
