exports.auth = function(req, res, next) {
  if (!req.isAuthenticated()) {
    res.sendStatus(401);
  } else {
    next();
  }
};

exports.hasRole = function(role) {
  return function (req, res, next) {
    if (req.user && req.user.role === role){
      next();
    } else {
      res.sendStatus(401, 'Unauthorized');
    }
  };
};

exports.isProjectOwner = function (req, res, next) {
  if (!req.user || !req.body.project_id) {
    res.sendStatus(403, 'Forbidden');
    return;
  }

  Models.Project.findOne({
    _id: req.body.project_id,
    _user: req.user._id
  }, function (err, project) {
    project ? next() : res.sendStatus(403, 'Forbidden');
  });
};

exports.hasProjectAccess = function (req, res, next) {
  var Project = Models.Project;
  var where = {
    _id: req.body.project_id,
    '_users.user': req.user._id
  };

  Project.find(where).exec(function (error, project) {
    project ? next() : res.sendStatus(403, 'Forbidden');
  });
};

exports.shouldPay = function (req, res, next) {
  req.user.should_pay(function (err, pay) {
    if (err) return next(err);
    pay ? res.redirect('/account/payments') : next();
  });
};
