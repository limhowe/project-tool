var log = debug('plans');
var async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
var demo_project_id = config.get('demo');

exports.pre_login = function (user, done) {
  increase_login_count(user, done);
};

exports.pre_first_login = function (user, state, done) {
  async.series([
    async.apply(assing_projects, user),
    async.apply(assign_nodes, user),
    async.apply(add_demo_project, user._id),
    async.apply(set_user_plan, user, state),
    async.apply(update_referral_plan, state),
  ], function (error) {
    done(error || null, error ? null : user);
  });
};

function set_user_plan(user, state, cb) {
  var state_data = typeof state === 'string' ? state.split(':') : [];
  var type = state_data[0], user_id = state_data[1];

  log('-> setting user plan');

  // Retrieve all plans available.
  Models.Plan.find({}, function (error, plans) {
    if (error) {
      cb(new Error('unable to retrieve plans'));
      return;
    }

    // Find plans for referral and invited users.
    var referralPlan = null,
      invitePlan = null;

    _.each(plans, function (plan) {
      if (plan.id === 'free') {
        invitePlan = 'free';
      } else if (plan.id.substr(0, 3) === '1to') {
        referralPlan = plan.id;
      }
    });

    // Subscribe users to default plans.
    var Subscription = Models.Subscription;

    if (!user_id || type === 'referral') {
      if (referralPlan) {
        Subscription.subscribe(user, referralPlan, null, cb);
        console.log('--> user plan set to ' + referralPlan);
      } else {
        cb(new Error('no default plan for referral users'));
      }
    } else if (type === 'invite') {
      if (invitePlan) {
        Subscription.subscribe(user, invitePlan, null, cb);
        log('--> user plan set to ' + invitePlan);
      } else {
        cb(new Error('no default plan for invited users'));
      }
    } else {
      cb(new Error('unable to set user plan'));
    }
  });
}

function update_referral_plan(state, cb) {
  var User = Models.User;

  var state_data = typeof state === 'string' ? state.split(':') : [];
  var type = state_data[0],
    user_id = state_data[1];

  if (!type || !user_id) {
    return cb(null);
  }

  log('-> update referral plan');

  if (type === 'invite') {
    User.upgrade_plan(user_id, cb);
    log('--> ref user plan upgraded');
  } else if (type === 'referral') {
    User.give_free_month(user_id, cb);
    log('--> ref user got free month');
  } else {
    cb(new Error('wrong state'));
  }
}

exports.handleSocialAuth = function (service, social_key) {
  return function (req, accessToken, refreshToken, profile, done) {
    var User = Models.User;

    var email = profile.emails[0].value
    var state = req.query.state;

    state = state.split(':');
    var language = state[0];

    if (state.length > 1) {
      state = [state[1], state[2]].join(':');
    } else {
      state = true;
    }

    var findQuery = {};
    findQuery[social_key] = profile.id;

    User.findOne(findQuery, function (err, user) {
      if (err) {
        return done(err);
      }

      if (user) {
        return exports.pre_login(user, done);
      }

      User.findOne({ email: email }, function (err, user) {
        if (user) {
          // attach social login to user
          user.set(social_key, profile.id);
          user.save(function (err) {
            if (err) {
              return done(err);
            }

            if (user) {
              return exports.pre_login(user, done);
            }
          });
        } else {
          // create new user with social login
          var userObject = {
            'username':            profile.id,
            'email':               email,
            'password':            profile.id + new Date().getTime(),
            'name.first':          profile.name.givenName,
            'name.last':           profile.name.familyName,
            'confirmation.status': true,
            language: language,
          };
          userObject[social_key] = profile.id;

          User.create(userObject, function (error, user) {
            if (error) {
              return done(error);
            }

            exports.pre_login(user);
            exports.pre_first_login(user, state, done);
          });
        }
      });
    });
  }
};

function assing_projects(user, cb) {
  var Project = Models.Project;

  log('assigning projects');
  Project.update(
    {
      '_users.invite_email': user.email
    },
    {
      $set: {
        '_users.$.user': user._id
      },
      $unset: {
        '_users.$.invite_email': ''
      }
    },
    {
      multi: true
    },
    cb
  );
}

function assign_nodes(user, cb) {
  var Node = Models.Node;

  log('assigning nodes');
  Node.update(
    {
      'assigned_users.invite_email': user.email
    },
    {
      $set: { 'assigned_users.$.user': user._id },
      $unset: { 'assigned_users.$.invite_email': '' }
    },
    {
      multi: true
    },
    cb
  );
}

function increase_login_count(user, cb) {
  Models.User
    .update(
      {
        _id: user._id
      },
      {
        $inc: {
          login_count: 1
        }
      }
    )
    .exec(function (error) {
      if (cb) {
        cb(error, error ? null : user);
      }
    });
}

function add_demo_project(user_id, cb) {
  var Node = Models.Node;
  var Risk = Models.Risk;
  var Project = Models.Project;
  var Board = Models.Board;
  var List = Models.List;
  var RACI = Models.Raci;
  var demo_project;
  var Comment = Models.Comment;

  async.waterfall([
    // clone project
    function (callback) {
      Project.findById(demo_project_id,  function (error, _demo_project) {
        if (error) {
          console.log('--> Error on project Get');
          console.log(error);
          return;
        };

        if (!_demo_project) {
          return callback('demo project does not exist.');
        }

        console.log('--> project fetched');

        _demo_project._id = new ObjectId();

        demo_project = new Project(_demo_project);
        demo_project._user = user_id;
        demo_project.isDemo = true;
        demo_project.save(function (error, project) {
          if (error) {
            console.log("error on saving project");
            console.log(error);
            return;
          }
          console.log('Project copied');
          callback(null, project);
        });
      });
    },
    // clone nodes and dependencies
    function (project, callback) {
      Node.find({_project: demo_project_id}, function (error, nodes) {
        console.log('---> fetched nodes');
        if (error) {
          console.log('-->Error on node fetching');
          console.log(error);
        }

        if (!nodes) {
          console.log('--> Nodes not found');
          return;
        }

        var $nodes = [];
        var change_log = [];

        // clone nodes and log id change
        nodes.forEach(function (node) {
          var original_id = node._id;
          var demo_node;
          node.user = user_id;
          node._id = new ObjectId();
          node._project = ObjectId(demo_project._id);

          if (node._quality && node._quality.length) {
            node._quality.forEach(function (q) {
              q._id = new ObjectId();
            });
          }

          if (node.files && node.files.length) {
            node.files.forEach(function (q) {
              q._id = new ObjectId();
            });
          }

          if (node.assigned_users && node.assigned_users.length) {
            node.assigned_users.forEach(function (q) {
              q._id = new ObjectId();
            });
          }

          demo_node = new Node(node);
          change_log.push({
            original_id: original_id,
            demo_id: demo_node._id
          });
          $nodes.push(new Node(demo_node));
        });

        // update dependencies to new node _ids
        $nodes.forEach(function (node) {
          if (!node._dependency || !node._dependency.length) {
            return;
          }

          node._dependency.forEach(function (dep) {
            change_log.forEach(function (log) {
              if (log.original_id + " " == dep.node + " ") {
                dep.node = log.demo_id;
                dep._id = new ObjectId();
              }
            });
          });
        });

        $nodes.forEach(function (node, index) {
          var new_nodes = [];
          if (node._nodes && node._nodes.length) {
            node._nodes.forEach(function (child_node, index) {
              change_log.forEach(function (log) {
                if (child_node+" " == log.original_id + " ") {
                  new_nodes.push(ObjectId(log.demo_id));
                }
              });
            });
          }

          $nodes[index]._nodes = new_nodes;

          if (node._parent) {
            change_log.forEach(function (log) {
              if (node._parent+" " == log.original_id+" ") {
                $nodes[index]._parent = ObjectId(log.demo_id);
              }
            });
          }
        });

        Node.create($nodes, function (error, _nodes) {
          if (error) {
            console.log('--> Error saving nodes');
            console.log(error);
          };

          console.log("--> Nodes saved");
          callback(null, project, _nodes, change_log);
        });
      });
    },
    // clone risks
    function (project, nodes, change_log, callback) {
      Risk.find({project: demo_project_id}, function (error, risks) {
        if (error) {
          console.log("--> error on risk fetching");
          console.log(error);
        }

        if (!risks) {
          console.log('--> Risks not found');
          return;
        }

        console.log("--> Risk fetched");

        risks.forEach(function (risk) {
          risk._id = new ObjectId();
          risk.project = project._id;
        });

        Risk.create(risks, function (error, data) {
          console.log("--> Risk saved");
          callback(null, project, nodes, change_log);
        });
      });
    },
    // clone boards and lists
    function (project, nodes, change_log, callback) {
      async.waterfall([
        function (callback) {
          var $boards = [];
          Board.find({project: ObjectId(demo_project_id)}, function (error, boards) {
            if (error) {
              console.log("--> error on Board fetching");
              console.log(error);
            }

            if (!boards) {
              console.log('--> Boards not found');
              return;
            }

            console.log("--> Boards fetched");

            boards.forEach(function (board) {
              board.old_id = board._id;
              board._id = new ObjectId();
              board.project = project._id;

              var demo_board = new Board(board);
              demo_board.old_id = board.old_id;
              $boards.push(demo_board);
            });

            Board.create($boards, function (error, boards) {
              if (error) {
                console.log("--> error on Board create");
                console.log(error);
                return;
              }

              console.log("--> Board created");
              callback(null, $boards, project, nodes, change_log);
            });
          });
        },
        function (boards, project, nodes, change_log, callback) {
          if (!boards || !boards.length) {
            callback(null, null, boards, project, nodes, change_log);
            return;
          }

          $lists = [];
          boards.forEach(function (board) {
            List.find({board: ObjectId(board.old_id)}, function (error, lists) {
              if (error) {
                console.log("--> error on list fetching");
                console.log(error);
              }

              if (!lists) {
                console.log('--> Lists not found');
                callback(null, null, $boards, project, nodes, change_log);
                return;
              }

              console.log("--> Lists fetched");

              if (lists) {
                lists.forEach(function (list) {
                  list._id = new ObjectId();
                  list.board = ObjectId(board._id);
                  if (list.tasks && list.tasks.length) {
                    list.tasks.forEach(function (task, i) {
                      change_log.forEach(function (log) {
                        if (task.node + " " == log.original_id + " ") {
                          nodes.forEach(function (__node) {
                            if (log.demo_id == __node._id) {
                              task.node = ObjectId(__node._id);
                              task.position = i;
                            }
                          });
                        }
                      });
                    });
                  }
                  demo_list = new List(list);
                  $lists.push(demo_list);
                });
              }

              List.create($lists, function (error, lists) {
                if (error) {
                  console.log(error);
                  return;
                }

                console.log('--> lists saved');
                callback(null, lists, boards, project, nodes, change_log);
              });
            });
          });
        },
        function (lists, boards, project, nodes, change_log, callback) {
          var $racis = [];
          RACI.find({project: demo_project_id}, function (error, racis) {
            if (error) {
              console.log(error);
              return;
            }

            if (!racis) {
              return;
            }

            racis.forEach(function (raci) {
              change_log.forEach(function (log) {
                if (log.original_id + " " == raci.node + " ") {
                  raci.node = ObjectId(log.demo_id);
                }
              });

              raci._id = new ObjectId();
              raci.project = ObjectId(project._id);
              var demo_raci = new RACI(raci);
              $racis.push(demo_raci);
            });

            RACI.create($racis, function (error, _racis) {
              if (error) {
                console.log(error);
                return;
              }

              console.log('--> raci created');
              callback(null, null);
            });
          });
        }
      ], function (err, result) {
          // result now equals 'done'
          callback(null, project, nodes, change_log);
      })
    }
  ], function (err, result) {
    // result now equals 'done'
    cb();
  });
}
