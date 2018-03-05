var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var Auth = Helpers.auth;

passport.use(
  new GoogleStrategy(
    config.get('google'),
    Helpers.auth.handleSocialAuth('google', 'social.google.id')
  )
);

app.get('/auth/google', function (req, res) {
  var state = [
    req.query.language || 'en',
  ];

  if (req.query.type) {
    state.push(req.query.type);
    state.push(req.query.user_id);
  }

  var options = {
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: state.join(':'),
  };

  passport.authenticate('google', options)(req, res);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signin' }),
  Middlewares.secure.shouldPay,
  function(req, res) {
    res.redirect('/app/');
  }
);
