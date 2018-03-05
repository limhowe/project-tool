var auth = Middlewares.secure.auth;
var User = Models.User;
var Subscription = Models.Subscription;
var Api_Response = Middlewares.general.api_response;

app.post('/api/payment/card/update', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  stripe.customers.createSource(
    req.user.stripe_id,
    { source: req.body.token },
    function(err, card) {
      if (err) return api_response(err);

      Subscription.update({ user: req.user }, { card: card }, {}, function () {
        api_response(null, { success: true });
      });
    }
  );
});

app.post('/api/payment/plan/get', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Subscription.findOne(req.user.subscription)
  .populate('plan')
  .exec(function (err, subscription) {
    api_response(null, { plan: subscription });
  })
});
