module.exports = function () {
  var Subscription = Models.Subscription;
  var cutoff = new Date();

  cutoff.setDate(cutoff.getDate() - 60);

  var query = {
    created_at: { $lt: cutoff },
    plan: 'free'
  };

  Subscription.find(query, function (error, users) {
    // if (error) return;
    // users.forEach(function (user) {
    //   Models.User.removeFully(user._id);
    // });
  });
};
