var deploy = Helpers.deploy;

app.post('/deploy', function (req, res, next) {
  var payload = JSON.parse(req.body.payload);

  if (payload && payload.commits) {
    for(var i=0; i<payload.commits.length; i++) {
      var prod = (payload.commits[i].branch === 'master' && app.get('env') === 'production');
      var dev = (payload.commits[i].branch === 'develop' && app.get('env') === 'dev-server');

      if (prod) return deploy.prod();
      if (dev) return deploy.dev();
    }
  }
});
