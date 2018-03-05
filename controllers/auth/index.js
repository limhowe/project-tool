var fs = require('fs');
var passport = require('passport');

var User = Models.User;
var Node = Models.Node;
var Project = Models.Project;

var Api_Response = Middlewares.general.api_response;
var mailer = Helpers.mailer();
var auth = Middlewares.secure.auth;

passport.serializeUser(function (user, done) {
  if (user && user._id) {
    done(null, user._id.toString());
  } else {
    done('Error serializing user');
  }
});

passport.deserializeUser(function (id, done) {
  User.findById(id).exec(done);
});

app.use(passport.initialize());
app.use(passport.session());

fs
  .readdirSync(__dirname)
  .filter(function (name) {
    return name !== 'index.js';
  })
  .forEach(function (name) {
    require(__dirname + '/' + name);
  });

/**
 * Check login status.
 */
app.post('/api/loggedin', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  var data = {
    success: req.isAuthenticated()
  };

  if (data.success) {
    data.user = Helpers.user.public(req.user);
  }

  generateResponse(null, data);
});

/**
 * Check payment status.
 */
app.get('/api/payment-status', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  req.user.should_pay(function (error, pay) {
    generateResponse(null, {
      shouldPay: !error ? pay : false
    });
  });
});

app.post('/api/admin/loggedin', Middlewares.secure.hasRole(User.roles.codes.ADMIN), function (req, res) {
  var api_response = Api_Response(req, res, next);

  var data = {
    success: req.isAuthenticated()
  };

  if (data.success) {
    data.user = Helpers.user.public(req.user);
  }

  api_response(null, data);
});

app.post('/api/is_authenticated', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  api_response(null, {
    success: req.isAuthenticated()
  });
});

app.post('/api/user/confirm', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var query = {
    'confirmation.code': req.body.code,
    'confirmation.status': false
  };

  User.findOne(query, function (error, user) {
    if (error) {
      return api_response(error);
    }

    if (user) {
      user.update({
        'confirmation.status': true
      }, {}, function (error) {
        if (error) {
          return api_response(error);
        }
        api_response(null, {
          language: user.language || 'en',
        });
      });
    } else {
      api_response('No user found');
    }
  });
});

app.post('/api/signout', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  if (! req.user) {
    req.logout();
    return api_response(null, {});
  }

  var req_user_id = req.user._id;
  var req_user_email = req.user.email;
  var changedProjects = [];
  var projectCreated = req.body.projectCreated;

  async.series([
    function (cb) {
      req.body.changedProjects.forEach(function (project_id) {
        Project.findOne({'_id': project_id}, function (err, project) {
          if (err) {
            return;
          }
          changedProjects.push(project._id.id);
        });
      });
      cb(null);
    },
    function (cb) {
      Project
        .find({
          '_users.user': req_user_id,
          '_users.need_send_email': true
        })
        .exec(function (error, projects) {
          if (error) {
            return;
          }

          projects.forEach(function (project) {
            if (changedProjects.indexOf(project._id.id) < 0) {
              User.findOne({_id: project._user}, function (err, user) {
                if (err) {
                  return;
                }

                mailer.send({
                  to: [{
                    email: req_user_email
                  }],
                  subject: "Forget Something?"
                }, {
                  name: 'project/needTask',
                  language: req.user.language,
                  params: {
                    domain: config.get('domain'),
                    owner_email: user.email,
                    project_id: project._id
                  }
                }, function (error, response) {});
              });
            }

            async.series([
              function (callback) {
                User.findOne({ _id: req_user_id }, function (err, user) {
                  if (err) {
                    return callback(err);
                  }

                  project._users.forEach(function (_user) {
                    if (_user.user.id == user._id.id) {
                      _user.need_send_email = false;
                      return callback(null);
                    }
                  });
                });
              },
              function (callback) {
                project.save(function (error) {});
                callback(null);
              }
            ], function (error, results) {
              /* silence */
            });
          });
        });
      cb(null);
    }
  ], function (err, result) {});

  /*if (!projectCreated) {
    User.findOne({_id: req_user_id, need_send_email: true}, function (err, user) {
      if (err) {
        next(err);
      }

      if (user == null) {
        return;
      }

      mailer.send(
        {
          to: [{
            email: req_user_email
          }],
          subject: "Had to run?"
        },
        {
          name: 'user/needTask',
          language: user.language,
          params: {
            domain: config.get('domain')
          }
        }
      , function (error, response) {
      });

      user.need_send_email = false;
      user.save(function (error) {
        next(error);
      });
    });
  }*/

  req.logout();
  api_response(null, {});
});
