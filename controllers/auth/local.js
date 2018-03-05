var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var Api_Response = Middlewares.general.api_response;

var User = Models.User;
var Node = Models.Node;
var Project = Models.Project;

var mailer = Helpers.mailer();

passport.use(new LocalStrategy(function (handle, password, done) {
  User.findOne({
    $or: [
      { username: handle },
      { email: handle }
    ]
  }, function (err, user) {
    if (err) return done(err);
    if (!user) return done(null, false, { message: 'signIn.unknownUser' });

    user.checkAllowed(function(err, allowed) {
      if (err) return done(err);
      if (!allowed) return done(null, false, { message: 'signIn.confirmEmail' });
      else {
        user.comparePassword(password, function (err, isMatch) {
          if (err) return done(err);
          if (isMatch) return Helpers.auth.pre_login(user, done);
          else return done(null, false, { message: 'signIn.invalidPassword' });
        });
      }
    });
  });
}));

app.post('/api/signin', function(req, res, next) {
  var api_response = Api_Response(req, res, next);

  passport.authenticate('local', function(error, user, info) {
    if (error) return api_response(error)
    if (!user) return api_response(info.message || info);

    req.logIn(user, function(error) {
      if (error) return api_response(error)

      var public_user = Helpers.user.public(user);

      user.should_pay(function (err, pay) {
        if (err) {
          pay = false;
        }

        public_user.should_pay = pay;

        return api_response(null, {
          success: true,
          user: public_user
        });
      });
    });
  })(req, res, next);
});

app.post('/api/signup', function(req, res, next) {
  var api_response = Api_Response(req, res, next);

  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;
  var language = req.body.language;
  var state = req.body.type ? [req.body.type, req.body.user_id].join(':') : true;

  var errors = _.union(
    Iz('email', email).string().email().errors,
    Iz('username', username).string().length(1, 150).errors,
    Iz('password', password).string().length(5, 150).errors
  );

  if (errors.length > 0) return api_response(errors);

  User.create(
    {
      username: username,
      email: email,
      password: password,
      language: language,
    }, function (error, user) {
      if (error) return api_response(error);

      mailer.send({
        to: [{ email: user.email, name: user.username}],
        subject: "Email confirmation"
      }, {
        name: 'user/confirmation',
        language: user.language,
        params: { user: user, domain: config.get('domain') }
      });

      Helpers.auth.pre_first_login(user, state, api_response);
    }
  );
});
