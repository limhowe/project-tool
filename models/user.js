var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;

var SALT_WORK_FACTOR = 10;
var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');

var log = debug('plans');

// Define roles
var rolesCodes = {
  USER: 'user',
  ADMIN: 'admin'
};

var rolesTitles = {};

rolesTitles[rolesCodes.USER] = 'User';
rolesTitles[rolesCodes.ADMIN] = 'Admin';

var UserSchema = mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, index: true, unique: true },
  name: {
    first: { type: String, required: false },
    last: { type: String, required: false }
  },
  address: { type: String, required: false },
  city: { type: String, required: false },
  state: { type: String, required: false },
  zip: { type: String, required: false },
  country: { type: String, required: false },
  language: {
    type: String,
    // By default, English is used.
    default: 'en',
  },
  avatar: { type: String, required: false },
  password: { type: String, required: true},
  role: { type: String, required: true, default: rolesCodes.USER },
  confirmation: {
    status: { type: Boolean, default: false },
    code: { type: String, required: false }
  },
  social: {
    google: {
      id: { type: String, required: false }
    },
    linkedin: {
      id: { type: String, required: false }
    },
    live: {
      id: { type: String, required: false }
    }
  },

  last_nag: { type: Date, require: false },
  login_count: { type: Number, required: false, default: 0 },

  stripe_id: { type: String, required: false },
  subscription: { type: Schema.ObjectId, ref: 'Subscription' },

  need_send_email: { type: Boolean, default: true},
  reset_token: { type: String, required: false },
  reset_expires: { type: String, required: false },
  has_seen_demo: {type: Boolean, default: false},
  has_seen_video: [
    {
      name: {
        type: String,
      },
      status: {
        type: Boolean,
      },
    }
  ],
  has_image: { type: Boolean, required: false, default: false },

  latestActivities: [{
    project: { type: Schema.ObjectId, ref: 'Project', required: false },
    activity: { type: Schema.ObjectId, ref: 'Activity', required: false }
  }],

  created_at: { type: Date, required: false }
});

UserSchema.methods.toJSON = function() {
  var obj = this.toObject();
  delete obj.password;
  return obj;
};

// Validation rules
UserSchema.path('username').validate( validation.uniqueFieldInsensitive('User', 'username' ), 'Username already in use' );
UserSchema.path('email').validate( validation.uniqueFieldInsensitive('User', 'email' ), 'Email already in use' );

UserSchema.pre('save', function(next) {
  var user = this;
  var crypto = require('crypto');
  var shasum = crypto.createHash('sha1');

  // confirmation code generating
  if (!user.confirmation.status && !user.confirmation.code) {
    shasum.update(user.email + new Date().getTime());
    user.confirmation.code = shasum.digest('hex');
  }

  if (!user.created_at) user.created_at = new Date();
  if (!user.isModified('password')) return next();

  bcrypt.genSalt(SALT_WORK_FACTOR, function(error, salt) {
    if(error) return next(error);

    bcrypt.hash(user.password, salt, function (){}, function(error, hash) {
      if(error) return next(error);
      user.password = hash;
      next();
    });
  });
});

UserSchema.methods.comparePassword = function(candidatePassword, done) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if(err) return done(err);
    done(null, isMatch);
  });
};

UserSchema.methods.generateReset = function (done) {
  var user = this;

  crypto.randomBytes(20, function(error, buf) {
    if (error) return done(error)

    var token = buf.toString('hex');
    var expires = Date.now() + 3600000; // 1 hour

    user.set('reset_token', token);
    user.set('reset_expires', expires);

    user.save(done);
  });
};

UserSchema.methods.checkAllowed = function(done) {
  return done(null, this.confirmation.status || this.login_count === 0);
};

UserSchema.statics.removeFully = function (user_id, done) {

  var User = this.model('User');
  var Project = this.model('Project');
  var Subscription = this.model('Subscription');

  done = done || function () {};

  async.waterfall([
    // remove projects
    function (callback) {
      Project.find({ _user: user_id }, function (error, projects) {
        if (error) return callback(error);

        projects.forEach(function (project) {
          project.remove(function () {});
        });

        return callback(null);
      });
    },
    // retrieve user
    function (callback) {
      User.findOne({ _id: user_id }, function (error, user) {
        return callback(error, user);
      });
    },
    // retrieve stripe customer
    function (user, callback) {
      if (user && user.stripe_id) {
        stripe.customers.retrieve(user.stripe_id, function(error, stripe_customer) {
          return callback(error, user, stripe_customer);
        });
      } else {
        return callback(null, user, null);
      }
    },
    // cancel stripe subscription
    function (user, stripe_customer, callback) {
      if (stripe_customer && stripe_customer.id && stripe_customer.subscription.id) {
        stripe.customers.cancelSubscription(stripe_customer.id, stripe_customer.subscription.id, function(err, confirmation) {
          return callback(err, user, stripe_customer);
        });
      } else {
        return callback(null, user, stripe_customer);
      }
    },
    // remove user
    function (user, stripe_customer, callback) {
      User.remove({ _id: user_id }, function(err) {
        return callback(err, user, stripe_customer);
      });
    },
    // remove subscription
    function (user, stripe_customer, callback) {
      Subscription.remove({ _id: user.subscription }, function(err) {
        return callback(err, user, stripe_customer);
      });
    }
  ], function (err) {
    if (err) {
      return done(err);
    } else {
      done(null);
    }
  });

};

UserSchema.statics.removeFromProjects = function (user_id, me) {
  var User = this.model('User');
  var Project = this.model('Project');
  var deffered = Q.defer();

  Project.find({ _user: me }, function (error, projects) {
    if (error) return;
    projects.forEach(function (project) {
      project._users.forEach(function (user) {
        if (user._id != user_id) {
          return;
        }

        project._users.splice(project._users.indexOf(user), 1);
        project.save(function (error, data) {
          deffered.resolve(data);
        });
      });
    });
  });

  return deffered.promise;
};

UserSchema.statics.removeFromProject = function (user_id, project_id) {
  var Project = this.model('Project');
  var deffered = Q.defer();
  Project.find({ _id: project_id }, function (error, projects) {
    if (error) {
      deffered.resolve(error);
      return;
    }

    projects.forEach(function (project) {
      project._users.forEach(function (user) {
        if (user._id != user_id) {
          return;
        }
        project._users.splice(project._users.indexOf(user), 1);
        project.save(function (error, data) {
          deffered.resolve(data);
        });
      });
    });
  });

  return deffered.promise;
};

UserSchema.methods.get_collaborators = function (done) {
  this
    .model('Project')
    .find({
      _user: this._id
    })
    .populate('_users.user')
    .exec(function (error, projects) {
      if (error) {
        return done(error);
      }

      var collaborators = _
        .chain(projects)
        .map(function (p) {
          return p._users;
        })
        .flatten()
        .compact()
        .uniq(function (u) {
          return String(u._id);
        })
        .value();

      done(null, collaborators);
    });
};

UserSchema.methods.should_pay = function (done) {
  if (! this.stripe_id) return done(null, false);

  stripe.customers.retrieve(this.stripe_id, function (err, customer) {
    if (err) return done(err);
    done(null, customer.delinquent);
  });
};

UserSchema.statics.upgrade_plan = function (user_id, done) {
  var Subscription = this.model('Subscription');
  var Plan = this.model('Plan');

  this.findById(user_id).exec(function (err, user) {
    if (err) return cb(err);
    if (! user) return cb(new Error('user not found'));

    log('---> upgrading plan for user');
    async.parallel({
      subscription: function (cb) {
        Subscription.findOne(user.subscription, function(error, item){
          console.log(error ? error : item )
        })
        .populate('plan')
        .exec(cb);
        log('----> get user subscription');
      },
      collaborators: function (cb) {
        user.get_collaborators(cb);
        log('----> get collaborators');
      }
    }, function (err, results) {
      var subscription;
      if (results.subscription[0]) {
        subscription = results.subscription[0];
      } else {
        subscription = results.subscription;
      }

      var collaborators = results.collaborators.length;

      if (collaborators <= subscription.plan.max_users) {
        return done(null, null);
      }

      Plan.get_plan_by_user_count(collaborators, function (err, plan) {
        log('----> get plan by user count: ' + plan.id);
        if (err) return done(err);
        Subscription.subscribe(user, plan, null, done);
      });
    });
  });
};

UserSchema.statics.give_free_month = function (user_id, cb) {
  var Subscription = this.model('Subscription');
  var Plan = this.model('Plan');

  log('---> giving free month to user');
  this.findById(user_id).exec(function (err, user) {
    if (err) return cb(err);
    if (! user) return cb(new Error('user not found'));

    log('----> get user subscription');
    Subscription.findOne({ user: user })
    .populate('plan')
    .exec(function (err, subscription) {
      if (err) return cb(err);

      log('-----> got user subscription');
      if (subscription.plan.id === 'free') {
        subscription.end_date = moment(subscription.end_date).add('1', 'month');
        subscription.save(done);
        log('-----> extending user free month');
      } else {
        var end_date = moment().add('1', 'month');
        Subscription.subscribe(user, 'free', end_date, cb);
        log('-----> subscribing free month');
      }
    });
  });
};

UserSchema.statics.assignedNodes = function (user_id, project_id) {
  var deffered = Q.defer();
  var Node = this.model('Node');

  var query = { _id: project_id, assigned_users: user_id };

  Node.find(query).exec(function (error, nodes) {
    if (error) return deffered.reject(error);
    deffered.resolve(nodes);
  });

  return deffered.promise;
};

module.exports = mongoose.model('User', UserSchema);

module.exports.roles = {
  codes: rolesCodes,
  titles: rolesTitles
};
