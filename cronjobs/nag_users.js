module.exports = function () {
  var User = Models.User,
    Plan = Models.Plan,
    days = [7, 15, 20, 25, 29, 30];

  Plan
    .find({
      id: 'free'
    })
    .exec(onPlanFind);

  function onPlanFind(error, plans) {
    if (error) {
      console.log('Failed to retrieve the Free plan details.');
      return;
    }

    if (!plans.length) {
      console.log('There is no Free plan.');
      return;
    }

    days.forEach(function (day) {
      var $lt = new Date(),
        $gt = new Date();

      $lt.setDate($lt.getDate() - day);
      $gt.setDate($gt.getDate() - day);

      $lt.setHours(0, 0, 1);
      $gt.setHours(23, 59, 59);

      User
        .find({
          last_nag: {
            $exists: false
          },
          created_at: {
            $lte: $gt,
            $gte: $lt
          }
        })
        .populate({
          path: 'subscription',
          match: {
            plan: plans[0]._id
          }
        })
        .exec(function (error, users) {
          onUserFind(error, users, day);
        });
    });

    // Remove last_nag fields to all users which has nag date yesterday
    var $lt = new Date(),
      $gt = new Date();

    $lt.setDate($lt.getDate() - 1);
    $gt.setDate($gt.getDate() - 1);

    $lt.setHours(0, 0, 1);
    $gt.setHours(23, 59, 59);

    User
      .find({
        last_nag: {
          $lt: $gt, $gt: $lt
        }
      })
      .populate({
        path: 'subscription',
        match: {
          plan: plans[0]._id
        }
      })
      .exec(onLastNagUserFind);
  }

  function onUserFind(error, users, day) {
    if (error) {
      console.log('Failed to retrieve users.');
      return;
    }

    users.forEach(function (user) {
      if (user.subscription) {
        Helpers.user.nag(user, day);
        user.set('last_nag', new Date()).save();
      }
    });
  }

  function onLastNagUserFind(error, users) {
    if (error) {
      console.log('Failed to retrieve users for last_nag reset.');
      return;
    }

    users.forEach(function (user) {
      if (user.subscription) {
        user.set('last_nag', undefined).save();
      }
    });
  }
};
