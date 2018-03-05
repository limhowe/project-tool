var passport = require('passport');
var LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

passport.use(
  new LinkedInStrategy(
    config.get('linkedin'),
    Helpers.auth.handleSocialAuth('linkedin', 'social.linkedin.id')
  )
);

app.get('/auth/linkedin', function (req, res) {
  var state = [
    req.query.language || 'en',
  ];

  if (req.query.type) {
    state.push(req.query.type);
    state.push(req.query.user_id);
  }

  var options = {
    scope: ['r_basicprofile', 'r_emailaddress'],
    state: state.join(':'),
  };

  passport.authenticate('linkedin', options)(req, res);
});

app.get('/auth/linkedin/callback',
  passport.authenticate('linkedin', { failureRedirect: '/signin' }),
  Middlewares.secure.shouldPay,
  function(req, res) {
    res.redirect('/app/');
  }
);
