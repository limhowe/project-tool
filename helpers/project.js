var async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;

exports.example = function (user, cb) {
  var Project = Models.Project;
  var Node = Models.Node;
  var project = new Project({
    name: 'Example project for ' + user.username || user.email,
    description: 'this is example project',
    isDemo: true,
    _user: user._id,
  });

  project.save(function (error, project) {
    if (error) return cb(error);

    var node1 = {
      title: 'Your very first task',
      _project: project._id,
      user: user._id
    };

    var node2 = {
      title: 'Just another task for you',
      _project: project._id,
      user: user._id
    };

    Node.create(node1, node2, cb);
  });
};
