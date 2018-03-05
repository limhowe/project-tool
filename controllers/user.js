var fs = require('fs');
var passport = require('passport');
var auth = Middlewares.secure.auth;
var User = Models.User;
var Node = Models.Node;
var Project = Models.Project;
var mailer = Helpers.mailer();
var multipart = Middlewares.general.multipart();
var Api_Response = Middlewares.general.api_response;
var amazon = Helpers.amazon;
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;

app.get('/api/user/me', auth, getCurrentUser);

app.get('/api/user/has_demo', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.findOne({
    _user: ObjectId(req.user._id),
    isDemo: true
  }, function (error, project) {
	if (error) {
	  return api_response(error);
	} else {
      api_response(null, project ? {'has_demo':true} : {'has_demo':false});
	}
  });
});

app.get('/api/user/is_password/:password', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User.findOne({
    _id: req.user._id,
  }, function (error, user) {
	if (error) {
	  return api_response(error);
	}
  user.comparePassword(req.params.password, function (err, isMatch) {
    if (err) {
	    return api_response(error);
    }
    api_response(null, isMatch ? {'is_password':true} : {'is_password':false});
  });

  });
});

app.get('/api/user/:user_email/see_demo', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  User.update({
    _id: req.user._id
  }, {
    $set: {
      has_seen_demo: true
    }
  }, function (error, user) {
    api_response(null, user);
  });
});

app.put('/api/user/last_activity', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var options = {
    multi: true
  };

  User.update({
    _id: req.user._id
  }, {
    $pull: {
      latestActivities: {
        project: req.body.project
      }
    }
  }, options, function (error, user) {

    User.update({
      _id: req.user._id
    }, {
      $push: {
        latestActivities: {
          project: req.body.project,
          activity: req.body.activity
        }
      }
    }, function (error, user) {
      api_response(null, user);
    });

  });
});

app.get('/api/user/last_activity/:project', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User.findOne({
    _id: req.user._id,
  }, function (error, user) {
	if (error) {
	  return api_response(error);
	}

  var lastActivity = undefined;
  user.latestActivities.forEach(function(activity){
    if (activity.project == req.params.project) {
      lastActivity = activity;
    }
  });

  api_response(null, {'last_activity': lastActivity ? lastActivity.activity : undefined});

  });
});

/**
 * Retrieve current user info.
 */
function getCurrentUser(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  User
    .findById(req.user._id)
    .exec(function (error, user) {
      generateResponse(error, user);
    });
}

app.post('/api/user/update', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var body = req.body;
  var errors = [];
  var iz_em = [], iz_pa = [];

  User
    .findOne({
      username: req.user.username
    })
    .exec(onFindOneSuccess);

  function onFindOneSuccess(error, user) {
    if (error) {
      return api_response(error);
    }

    if (body.username) {
      User
        .find({
          $or: [{username: body.username}
            ,{email: body.email}]
          ,_id: {
            '$ne': ObjectId(user._id)
          }
        })
        .exec(function (error, usersWithSameUserName) {
          if (error) {
            return api_response(error);
          }

          if (usersWithSameUserName.length) {
            return api_response('account.userOrEmailTaken');
          }

          updateUser(user);
        });
    } else {
      updateUser(user);
    }
  }

  function updateUser(user) {
    if (body.email) {
      iz_em = Iz('email', body.email).string().email();
    }
    if (body.password) {
      iz_pa = Iz('password', body.password).string().length(5, 30);
    }

    errors = _.union(iz_em.errors, iz_pa.errors);
    if (errors.length) {
      return api_response(errors);
    }

    if (body.username) {
      user.set('username', body.username);
    }

    if (body.first_name) {
      user.set('name.first', body.first_name);
    }
    if (body.last_name) {
      user.set('name.last', body.last_name);
    }
    if (body.email) {
      user.set('email', body.email);
    }
    if (body.address) {
      user.set('address', body.address);
    }
    if (body.city) {
      user.set('city', body.city);
    }
    if (body.state) {
      user.set('state', body.state);
    }
    if (body.zip) {
      user.set('zip', body.zip);
    }
    if (body.country) {
      user.set('country', body.country);
    }
    if (body.language) {
      user.set('language', body.language);
    }
    if (body.password) {
      user.set('password', body.password);
    }

    if (body.has_seen_video) {
      user.set('has_seen_video', body.has_seen_video);
    }

    user.save(function (error) {
      if (error) {
        api_response(error);
      } else {
        req.logIn(user, function (error) {
          api_response(error);
        });
      }
    });
  }
});

app.post('/api/user/addCoupon', auth, function (req, res, next) {
  var apiResponse = Api_Response(req, res, next);

  if (!req.body.code) {
    return apiResponse('Please provide a coupon code to add.');
  }

  User.findOne({
    username: req.user.username
  }, function (error, user) {
    if (error) {
      return apiResponse(error);
    }

    stripe.customers.update(user.stripe_id, {
      coupon: req.body.code
    }, function (error, customer) {
      if (error) {
        apiResponse(error.message);
      } else {
        apiResponse(null);
      }
    });
  });
});

app.post('/api/user/invite', auth, function (req, res, next) {

  var api_response = Api_Response(req, res, next);
  var email = req.body.email;

  if (email === req.user.email) {
    return api_response('referral.youCanNotInviteYourself');
  }

  User.findOne({
     email: email
  }, function (error, user) {

     if (user) {
        return api_response('referral.userAlreadyExists');
     }

     Helpers.user.get_language(email, function(user_language){

       mailer.send(
         {
           to: [{ email: email }],
           subject: "You have received an invitation"
         },
         {
           name: 'user/invite',
           language: user_language,
           params: {
             domain: config.get('domain'),
             message: req.body.message,
             inviter: req.user,
             email: email
           }
         }, function (error) {
           api_response(error);
         }
       );

     });

  });

});

app.get('/referral/:username', function (req, res, next) {
  res.redirect('/signup/' + req.params.username);
});

app.post('/api/user/search', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var query = {
    $or: [
      {
        username: new RegExp(req.body.q, 'i')
      },
      {
        email: new RegExp(req.body.q, 'i')
      }
    ]
  };
  var options = {
    email: 1,
    username: 1,
    _id: 1
  };

  User.find(query, options, function (error, docs) {
    api_response(error, docs);
  });
});

app.post('/api/user/searchByUsername', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User.find({
    username: new RegExp(req.body.q, 'i')
  }, {
    username: 1,
    _id: 1
  }, function (error, docs) {
    api_response(error, docs);
  });
});

app.post('/api/user/searchByEmail', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User.find({
    email: new RegExp(req.body.q, 'i')
  }, {
    email: 1,
    _id: 1
  }, function (error, docs) {
    api_response(error, docs);
  });
});

app.post('/api/user/deactivate', function (req, res, next) {
  User.removeFully(req.user._id, Api_Response(req, res, next));
});

app.get('/api/user/collaborators', function (req, res, next) {
  req.user.get_collaborators(Api_Response(req, res, next));
});

app.delete('/api/user/:id/from_project', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User
    .removeFromProjects(req.params.id, req.user._id)
    .then(function () {
      api_response(null, null);
    });
});

app.delete('/api/user/:user_id/remove_from_project/:project_id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  User
    .removeFromProject(req.params.user_id, req.params.project_id)
    .then(function (error, response) {
      api_response(null, null);
    });
});

app.get('/api/user/:id/project/:project_id/nodes', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  User
    .assignedNodes(req.params.id, req.params.project_id)
    .then(function (nodes) {
      api_response(null, nodes);
    })
    .catch(api_response);
});

app.post('/user/reset', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var email = req.body.email;

  User.findOne({
    email: email
  }, function (error, user) {
    if (error || !user) {
      return api_response('Incorrect email');
    }

    user.generateReset(function (error) {
      if (error) {
        return api_response('Error while generating reset link');
      }

      mailer.send({
        to: [{
          email: user.email
        }],
        subject: "Password Reset"
      }, {
        name: 'user/reset',
        language: user.language,
        params: {
          domain: config.get('domain'),
          user: user
        }
      }, api_response(null, {'_id':user._id, 'email':user.email, 'language':user.language}));
    });
  });
});

app.get('/user/reset/:token', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  var options = {
    reset_token: req.params.token,
    reset_expires: {
      $gt: Date.now()
    }
  };

  User.findOne(options, function (error, user) {
	if (error) {
      api_response(error);
	}

    if (user) {
      api_response(null, {isValid:true} );
    } else {
      api_response(null, {isValid:false} );
	}
  });
});

app.post('/user/reset/:token', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var password = req.body.password;
  var options = {
    reset_token: req.params.token,
    reset_expires: {
      $gt: Date.now()
    }
  };

  User.findOne(options, function (error, user) {
    if (error || !user) {
      return api_response('reset.invalidToken');
    }

    user.password = password;
    user.reset_token = undefined;
    user.reset_expires = undefined;

    user.save(function (error) {
      api_response(error);
    });
  });
});

app.get('/api/user/assigned_tasks/', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Node.find({
    'assigned_users.user': req.user._id
  }, api_response);
});

app.get('/api/user/:id/image', function (req, res, next) {
  amazon
    .get_url('users', 'image', req.params.id)
    .then(function (url) {
      res.redirect(url);
    })
    .catch(function (error) {
      res.status(404).send('Not found');
    });
});

app.post('/api/user/:id/image', multipart, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var image = req.files && req.files.image;
  var user_id = req.params.id;
  var types = [
    'image/png',
    'image/jpeg'
  ];

  if (!image) {
    return api_response('Please provide an image');
  }
  if (types.indexOf(image.type) === -1) {
    return api_response('Unsupported image type');
  }

  var file = fs.readFileSync(image.path);

  amazon.upload('users', 'image', user_id, file)
  .then(function (url) {
    User.findByIdAndUpdate(
      user_id,
      {
        avatar: url,
        has_image: true
      }
    ).exec(function (error, user) {
      if (error) {
        return api_response(error);
      }
      api_response(null, url);
    });
  })
  .catch(function (error) {
    api_response(error);
  });
});

app.get('/api/user/invited_emails', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.aggregate([
    {
      $project: {
        _users: 1
      }
    },
    {
      $unwind: "$_users"
    },
    {
      $match: {
        "_users.user": null
      }
    },
  ], function (error, result) {
    if (error) {
      return api_response(error);
    }
    var emails = _.chain(result)
                    .map('_users')
                    .map('invite_email')
                    .value();

    api_response(null, emails);
  });
});

app.post('/api/user/get_by_id', auth, function (req, res, next) {
  var apiResponse = Api_Response(req, res, next);
  User.findById(ObjectId(req.body.userId), function (error, user) {
    apiResponse(error, user);
  })
});
