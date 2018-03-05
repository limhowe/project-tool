var auth = Middlewares.secure.auth;
var Plan = Models.Plan;
var Api_Response = Middlewares.general.api_response;

app.post('/api/plan/get', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Plan
    .find({})
    .exec(function (err, res) {
      api_response(null, res);
    })
});
