exports.prod = function () {
  var exec = Helpers.exec;

  exec('git pull -f origin master', { cwd: APP_PATH })
  .then(function (result) {
    console.log('pulled git...');
    return exec('npm install', { cwd: APP_PATH });
  })
  .then(function (result) {
    console.log('installed modules...');
    return exec('forever restart app.js', { cwd: APP_PATH });
  })
  .then(function (result) {
    console.log('restarted app...');
    console.log('deployed successfully');
  })
  .fail(function (error) {
    console.log('error during deployment', error);
  });
};

exports.dev = function () {
  var exec = Helpers.exec;
  
  exec('git pull -f origin develop', { cwd: APP_PATH })
  .then(function (result) {
    console.log('pulled git...');
    return exec('npm install', { cwd: APP_PATH });
  })
  .then(function (result) {
    console.log('installed modules...');
    return exec('forever restart app.js', { cwd: APP_PATH });
  })
  .then(function (result) {
    console.log('restarted app...');
    console.log('deployed successfully');
  })
  .fail(function (error) {
    console.log('error during deployment', error);
  });
};
