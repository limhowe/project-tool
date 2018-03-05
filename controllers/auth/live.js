var passport = require('passport');
var WindowsLiveStrategy = require('passport-windowslive').Strategy;

passport.use(
  new WindowsLiveStrategy(
    config.get('live'),
    Helpers.auth.handleSocialAuth('live', 'social.live.id')
  )
);

app.get('/auth/live', function (req, res) {
  var state = [
    req.query.language || 'en',
  ];

  if (req.query.type) {
    state.push(req.query.type);
    state.push(req.query.user_id);
  }

  var options = {
    scope: config.get('live').scope,
    state: state.join(':'),
  };

  passport.authenticate('windowslive', options)(req, res);
});

app.get(
  '/auth/live/callback',
  passport.authenticate('windowslive', { failureRedirect: '/signin' }),
  Middlewares.secure.shouldPay,
  function (req, res) {
    res.redirect('/app/');
  }
);
