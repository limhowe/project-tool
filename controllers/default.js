app.get('/', function (req, res) {
  res.render('index');
});

// Configuring render templates for angular as for default view folder
app.get('/view/:name', function (req, res) {
  res.render('../views/' + req.params.name + '.jade');
});

app.get('/view/:name/:subname', function (req, res) {
  res.render('../views/default/' + req.params.name + '/' + req.params.subname + '.jade');
});

app.get('/view/:app_name/:controller/:action_name', function (req, res) {
  res.render('../views/' + req.params.app_name + '/' + req.params.controller + '/' + req.params.action_name) + '.jade';
});

app.get('/views/:controller/:name', function(req, res){
  var url = 'default/' + req.params.controller + '/' + req.params.name + '.jade';
  res.render(url);
});
