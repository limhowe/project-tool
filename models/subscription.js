var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var log = debug('plans');

var Subscription = mongoose.Schema({
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  plan: {
    type: Schema.ObjectId,
    ref: 'Plan'
  },
  stripe: {
    type: Object,
    required: true
  },
  card: {
    type: Object,
    required: false
  },
  created_at: {
    type: Date,
    required: true,
    default: new Date()
  },
  ending_at: {
    type: Date,
    required: false
  }
});

Subscription.statics.subscribe = function (user, plan, end_date, done) {
  var Subscription = this;
  var Plan = this.model('Plan');

  async.waterfall([
    // retrieve stripe customer
    function (cb) {
      if (user.stripe_id) {
        stripe.customers.retrieve(user.stripe_id, cb);
      } else {
        cb(null, null);
      }
    },
    // create stripe customer if doesn't exist
    function (stripe_customer, cb) {
      if (stripe_customer && stripe_customer.deleted !== true) {
        return cb(null, stripe_customer);
      }

      stripe.customers.create({
        email: user.email
      }, function (err, stripe_customer) {
        if (err) {
          return cb (err);
        }

        user.stripe_id = stripe_customer.id;
        user.save(function (err) {
          if (err) {
            return cb(err);
          }
          cb(null, stripe_customer);
          log('---> created stripe customer');
        });
      });
    },
    // find plan in db
    function (customer, cb) {
      Plan.findOne({ id: plan }, function (err, plan) {
        if (!plan) {
          return cb(new Error('plan not found'));
        }
        cb(err, customer, plan);
        log('---> found plan in db');
      });
    },

    // create stripe subscription
    function (customer, plan, cb) {
      if (!plan) {
        return cb(new Error('plan not found'));
      }
      var trial_end_date = plan.id !== 'free' ? moment().add(1, 'month') : null;

      if (customer.subscriptions && customer.subscriptions.total_count !== 0
          && customer.subscriptions.data && customer.subscriptions.data.length) {
        var subscription = customer.subscriptions.data[0];

        stripe.customers.updateSubscription(
          customer.id,
          subscription.id,
          {
            plan: plan.id,
            trial_end: trial_end_date ? trial_end_date.unix() : 'now'
          },
          function(err, stripe_subscription) {
            cb(err, plan, stripe_subscription, trial_end_date);
            log('---> updated stripe subscription');
          }
        );
      } else {
        stripe.customers.createSubscription(customer.id, {
          plan: plan.id,
          trial_end: trial_end_date ? trial_end_date.unix() : 'now'
        }, function (err, stripe_subscription) {
          cb(err, plan, stripe_subscription, trial_end_date);
          log('---> created stripe subscription');
        });
      }
    },
    // create local subscription
    function (plan, stripe_subscription, trial_end_date, cb) {
      var ending_at = null;

      if (trial_end_date) {
        ending_at = trial_end_date.toDate();
      }

      if (end_date) {
        ending_at = end_date.toDate();
      }

      Subscription.create({
        user: user,
        plan: plan,
        stripe: stripe_subscription,
        ending_at: ending_at
      }, function (err, subscription) {
        cb(err, subscription);
        log('---> create subscription in db');
      });
    },

    // set subscription to user
    function (subscription, cb) {
      user.subscription = subscription._id;
      user.save(cb);
      log('---> saving user subscription in db');
    }
  ], function (err) {
    if (err) {
      return done(err);
    } else {
      done(null, null);
    }
    log('---> *** user subscribed ***');
  });
};

module.exports = mongoose.model('Subscription', Subscription);
