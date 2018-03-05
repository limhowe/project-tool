var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;

var Plan = mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  max_users: { type: Schema.Types.Mixed, required: true },
  stripe: { type: Object, required: true },
  created_at: { type: Date, required: true, default: new Date() }
});

Plan.statics.get_plan_by_user_count = function (user_count, done) {
  this.find({}, function (err, plans) {
    var plan = _.chain(plans)
    .filter(function (plan) { return typeof plan.max_users === 'number';  })
    .filter(function (plan) { return plan.max_users >= user_count; })
    .sortBy(function (plan) { return plan.max_users; })
    .first()
    .value();

    if (! plan) plan = _.findWhere(plans, { max_users: true });

    if (err) return done(err);
    done(null, plan.id);
  });
};

module.exports = mongoose.model('Plan', Plan);
