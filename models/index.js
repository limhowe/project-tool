module.exports = function () {
  require('mongoose').connect(config.get('db'));

  return fs
  .readdirSync(__dirname)
  .filter(function (name) { return name !== 'index.js'; })
  .reduce(function (Models, name) {
    Models[Helpers.string.upper(name)] = require(__dirname + '/' + name);
    return Models;
  }, {});
};
