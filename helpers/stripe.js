exports.sync_plans = function () {
  stripe.plans.list(function (err, plans) {
    plans.data.forEach(function (stripe_plan) {
      Models.Plan.findOne({ id: stripe_plan.id }, function (err, plan) {
        if (plan) {
          plan.stripe = stripe_plan;
          plan.save();
        } else {
          var data = {
            id: stripe_plan.id,
            name: stripe_plan.name,
            description: stripe_plan.name,
            stripe: stripe_plan
          };

          if (stripe_plan.id === 'free') data.max_users = false;
          else if (stripe_plan.id === 'unlimited') data.max_users = true;
          else data.max_users = +stripe_plan.id.split('to')[1];

          Models.Plan.create(data);
        }
      });
    });
  });
};
