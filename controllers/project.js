var async = require('async');
var fs = require('fs');
var secure = Middlewares.secure;
var User = Models.User;
var Project = Models.Project;
var Node = Models.Node;
var User = Models.User;
var Risk = Models.Risk;
var Raci = Models.Raci;
var Board = Models.Board;
var List = Models.List;
var Activity = Models.Activity;
var mailer = Helpers.mailer();
var translater = Helpers.translater;
var amazon = Helpers.amazon;
var multipart = Middlewares.general.multipart();
var Api_Response = Middlewares.general.api_response;
var ObjectId = require('mongoose').Types.ObjectId;
var _ = require('lodash');
var multer = require('multer');
var AsposeCloud = require('asposecloud');
var socket = Helpers.socket;

app.post('/api/project/:project_id/raci', secure.auth, addRaci);

app.get('/api/project/demo/get_users', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  Project.find({
    _user: ObjectId(req.user._id),
    isDemo: true
  }, function (error, projects) {
    api_response(error, projects[0]);
  });
});

app.get('/views/default/project/includes/:includePath', function (req, res) {
  res.render('default/project/includes/' + req.params.includePath);
});

app.get('/views/default/project/task_form/:includePath', function (req, res) {
  res.render('default/project/task_form/' + req.params.includePath);
});

app.get('/api/project/get_demo_project/',function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  Project.find({
    _user: req.user._id
  }, function (error, docs) {
    api_response(error, docs);
  });
});

app.get('/api/project/:id', secure.auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project
    .findOne({
      _id: req.params.id
    })
    .populate('_user _users.user')
    .exec(function (error, project) {
      api_response(error, project);
    });
});

app.post('/api/project', secure.auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var name = req.body.name;
  var description = req.body.description;
  var use_quality = !!req.body.use_quality;
  var show_numbers = !!req.body.show_numbers;
  var hide_complete = !!req.body.hide_complete;
  var plan_message = 'Invited users are unable to create projects without subscribing to PlanHammer,' +
      'please go to payment tab and enter your card information';

  User.findOne({
    username: req.user.username
  }, function (error, user) {
    if (error) {
      return api_response(error);
    }

    // Project.find({
    //   _user: user._id
    // }, function (error, existing_projects) {
    //   var dublicated;
    //   if (existing_projects && existing_projects.length) {
    //     existing_projects.forEach(function (project) {
    //       if (project.name == name) {
    //         dublicated = true;
    //       };
    //     });
    //   }

    //   if (dublicated) {
    //     api_response("A project named " + name + " already exists", {
    //       project: project
    //     });
    //   } else {
        if (user.plan === 'dummy') {
          return api_response(plan_message);
        }

        var project = new Project({
          name: name,
          description: description,
          _user: user._id,
          settings: {
            use_quality: use_quality,
            show_numbers: show_numbers,
            hide_complete: hide_complete
          }
        });

        project.save(function (error) {
          if (error) {
            return api_response(error);
          }

          User.upgrade_plan(req.user._id, function (err) {
           if (err) {
             return api_response(err);
           }

            api_response(null, {
              project: project
            });
          });

        });
    //   }
    // });
  });
});

app.post('/api/project/import', secure.auth, function (req, res, next) {
  var import_file = req.files.projectFile;
  var user_id = req.user._id;
  var api_response = Api_Response(req, res, next);

  fs.readFile(import_file.path, function (readErr, data) {
    if (readErr) {
      return next(readErr);
    }

    User.findOne({
      _id: user_id
    }, function (err, user) {
      if (err) {
        return next(err);
      }

      mailer.send({
        to: [ {
          email: 'support@planhammer.io'
        } ],
        subject: translater.translate('Custom Project to Import for $[1]', 'en', user_id),
      }, {
        name: 'project/import',
        params: {
          domain: config.get('domain'),
          owner_email: user.email,
          owner_name: user.username,
          file_name: import_file.name
        }
      }, function (error, response) {
        if (error) {
          return next(error);
        }
        api_response(null, {
          result: {
            success: 1,
            message: 'Successfully sent!!!'
          }
        });
      });
    });
  });
});

app.post('/api/project/list', secure.auth, function (req, res, next) {
  var type = req.body.type || 'created';
  var api_response = Api_Response(req, res, next);

  if (type === 'shared') {
    Project
      .find({
        '_users.user': req.user._id
      })
      .populate('_users.user')
      .exec(function (error, projects) {
        api_response(error, { projects: projects });
      });
  } else if (type === 'created') {
    Project.find({
      _user: req.user._id
    }, function (error, projects) {
      api_response(error, {
        projects: projects
      });
    });
  } else {
    api_response('You defined wrong list type');
  }
});

app.post('/api/project/invite', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  var project_id = req.body.project;
  var user_email = req.body.email;

  var iz_em = Iz('email', user_email).string().email();
  if (!iz_em.valid) {
    return api_response('global.invalidEmail');
  }

  async.waterfall([
    function (callback) {
      Project
        .findOne({
          _id: project_id
        })
        .populate('_user _users.user')
        .exec(function (error, project) {
          if (error) {
            return callback(error);
          }

          if (!project) {
            return callback('global.projectNotFound');
          }

          if (project._user._id.toString() !== req.user._id.toString()) {
            return callback('invite.noPermission');
          }

          if (project._user.email == user_email) {
            return callback('invite.userIsProjectOwner');
          }

          if (_(project._users).findWhere({
            invite_email: user_email
          })) {
            return callback('invite.alreadyInvited');
          }

          if (_.chain(project._users).map(function (u) {
            return u.user || {};
          }).findWhere({
            email: user_email
          }).value()) {
            return callback('invite.alreadyAdded');
          }

          callback(null, project);
        });
    },
    function (project, callback) {
      User.findOne({
        email: user_email
      }, null, function (err, user) {
        callback(err, user, project);
      });
    },
    function (user, project, callback) {
      project._users.push(user
        ? {
            user: user._id,
            referral: req.user._id
          }
        : {
            invite_email: user_email,
            referral: req.user._id
          });

      project.save(function (err) {
        callback(err, user, project);
      });
    },
    function (user, project, callback) {
      mailer.send({
        to: [{
          email: user_email
        }],
        subject: "You have received a PlanHammer project invitation"
      }, {
        name: 'project/invite',
        language: user ? user.language : req.user.language,
        params: {
          domain: config.get('domain'),
          project: project,
          is_registered: user ? true : false,
          user: req.user,
          email: user_email
        }
      }, function (err) {
        callback(err, user);
      });
    },
    function (user, callback) {
      User.upgrade_plan(req.user._id, function (error) {
       if (error) {
         callback(error);
         return;
       }

        callback(null, user);
      });
    }
  ], function (error, user) {
    if (error) {
      return api_response(error);
    }

    var userDetails = {
      email: user_email
    };

    if (user) {
      userDetails._id = user._id;
    }

    api_response(error, {
      user: userDetails
    });
  });
});

app.post('/api/project/reject_user', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var email = req.body.email;
  var project_id = req.body.project_id;

  User
    .findOne({
      email: email
    })
    .exec(function (error, user) {
      if (error) {
        return api_response(error);
      }

      var pullQuery;
      if (user) {
        pullQuery = {
          user: user.id
        };
      } else {
        pullQuery = {
          invite_email: email
        };
      }

      Project.update(
        {
          _id: project_id,
          _user: req.user._id
        },
        {
          $pull: {
            _users: pullQuery
          }
        },
        {
          multi: true
        }
      )
      .exec(api_response);
    });
});

app.put('/api/project/:id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.update({
    _id: req.params.id
  }, {
    $set: req.body
  }, function (error) {
    api_response(error);
  });
});

app.post('/api/project/delete', secure.isProjectOwner, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.findById(req.body.project_id, function (error, project) {
    if (error) return api_response(error);

    if (project) {
      project.remove(api_response);
    } else {
      api_response('Project doesn\'t exist');
    }
  });
});

app.post('/api/project/:id/clone', secure.auth, function (req, res, next) {
  var apiResponse = Api_Response(req, res, next);

  var clonedProjectId = req.params.id;
  async.waterfall(
    [
      cloneProject,
      cloneNodes,
      cloneRisks,
      cloneBoardsAndLists,
    ],
    function (error, project) {
      if (error) {
        return apiResponse(error);
      }

      return apiResponse(null, project);
    }
  );

  function cloneProject(callback) {
    Project.findById(clonedProjectId, function (error, project) {
      if (error) {
        return callback(error);
      }

      /**
       * Due to issues with the versioning key (__v) when cloning a document,
       * we need to make sure the new [cloned] object is created without
       * the original document's versioning key.
      */
      var projectData = project.toJSON ? project.toJSON() : project; // A clone of the model from the project object.

      projectData._id = new ObjectId();
      delete projectData.__v;

      var newProject = new Project(projectData);
      newProject.name = newProject.name + '_copy';
      newProject.created_at = new Date();


      newProject.save(function (error, projectCreated) {
        if (error) {
          return callback(error);
        }
        callback(null, projectCreated);
      });
    });
  }

  function cloneNodes(project, callback) {
    Node
      .find({
        _project: clonedProjectId,
      })
      .sort('position')
      .exec(function (error, nodes) {
        if (error) {
          return callback(error);
        }

        // If there is no node to copy, exit.
        if (!nodes) {
          return callback(null, project);
        }

        var newNodes = [];
        var changeLog = [];

        // Clone nodes and log ID changes.
        _.each(nodes, function (node) {
          node = node.toJSON ? node.toJSON() : node; // Create a clone for manipulation
          delete node.__v; // Remove the versioning key to avoid conflicts.
          var originalId = node._id;

          node._id = new ObjectId();
          node._project = ObjectId(project._id);

          if (node._quality && node._quality.length) {
            _.each(node._quality, function (quality) {
              quality._id = new ObjectId();
            });
          }

          if (node.files && node.files.length) {
            _.each(node.files, function (file) {
              file._id = new ObjectId();
            });
          }

          if (node.assigned_users && node.assigned_users) {
            _.each(node.assigned_users, function (user) {
              user._id = new ObjectId();
            });
          }

          var newNode = new Node(node);
          newNodes.push(newNode);

          changeLog.push({
            originalId: String(originalId),
            newId: String(newNode._id),
          });
        });

        // Update dependencies to new node IDs.
        _.each(newNodes, function (node) {
          if (!node._dependency || !node._dependency.length) {
            return;
          }

          _.each(node._dependency, function (dependency) {
            _.each(changeLog, function (log) {
              if (log.originalId == String(dependency.node)) {
                dependency.node = log.newId;
                dependency._id = new ObjectId();
              }
            });
          });
        });

        _.each(newNodes, function (node, index) {
          var childNodes = [];
          if (node._nodes && node._nodes.length) {
            _.each(node._nodes, function (childNode) {
              _.each(changeLog, function (log) {
                if (String(childNode) == log.originalId) {
                  childNodes.push(ObjectId(log.newId));
                }
              });
            });
          }

          newNodes[index]._nodes = childNodes;

          if (node._parent) {
            _.each(changeLog, function (log) {
              if (String(node._parent) == log.originalId) {
                newNodes[index]._parent = ObjectId(log.newId);
              }
            });
          }
        });


        Node.create(newNodes, function (error, nodes) {
          if (error) {
            return callback(error);
          }

          callback(null, project, nodes, changeLog);
        });
      });
  }

  function cloneRisks(project, nodes, changeLog, callback) {
    Risk
      .find({
        project: clonedProjectId,
      })
      .exec(function (error, risks) {
        if (error) {
          return callback(error);
        }

        if (!risks) {
          return callback(null, project, nodes, changeLog);
        }

        _.each(risks, function (risk, index) {
          risk = risk.toJSON ? risk.toJSON() : risk;
          delete risk.__v;
          risk._id = new ObjectId();
          risk.project = project._id;
          risks[index] = risk;
        });

        Risk.create(risks, function (error, data) {
          return callback(null, project, nodes, changeLog);
        });
      });
  }

  function cloneBoardsAndLists(project, nodes, changeLog, callback) {
    async.waterfall(
      [
        cloneBoards,
        cloneLists,
        cloneRacis,
      ],
      function (error, result) {
        if (error) {
          return callback(error);
        }
        callback(null, project, nodes, changeLog);
      }
    );

    function cloneBoards(callback) {
      var newBoards = [];

      Board
        .find({
          project: ObjectId(clonedProjectId),
        })
        .exec(function (error, boards) {
          if (error) {
            return callback(error);
          }

          if (!boards) {
            return callback(null, newBoards, project, nodes, changeLog);
          }

          _.each(boards, function (board) {
            board = board.toJSON ? board.toJSON() : board;
            delete board.__v;
            board.oldId = board._id;
            board._id = new ObjectId();
            board.project = project._id;

            var newBoard = new Board(board);
            newBoard.oldId = board.oldId;
            newBoards.push(newBoard);
          });

          Board.create(newBoards, function (error, boards) {
            if (error) {
              return callback(error);
            }

            callback(null, newBoards, project, nodes, changeLog);
          });
        });
    }

    function cloneLists(boards, project, nodes, changeLog, callback) {
      if (!boards || !boards.length) {
        return callback(null, null, boards, project, nodes, changeLog);
      }

      var boardIds = _.pluck(boards, 'oldId');

      List
        .find({
          board: {
            '$in': boardIds,
          },
        })
        .exec(function (error, lists) {
          if (error) {
            return callback(error);
          }

          if (!lists) {
            return callback(null, null, boards, project, nodes, changeLog);
          }

          var newLists = [];

          var boardLists = [];

          _.each(lists, function (list) {
            list = list.toJSON ? list.toJSON() : list;
            delete list.__v;
            var originalListId = String(list._id);
            list._id = new ObjectId();

            _.find(boards, function (board) {
              if (String(board.oldId) != String(list.board)) {
                return false;
              }

              list.board = board._id;

              _.each(board.lists, function (listId) {
                if (String(listId) != originalListId) {
                  return;
                }

                if (_.isUndefined(boardLists[board._id])) {
                  boardLists[board._id] = [];
                }
                boardLists[board._id].push(list._id);
              });

              return true;
            });

            if (list.tasks && list.tasks.length) {
              _.each(list.tasks, function (task, index) {
                _.each(changeLog, function (log) {
                  if (String(task.node) != log.originalId) {
                    return;
                  }

                  _.each(nodes, function (node) {
                    if (log.newId == String(node._id)) {
                      task.node = node._id;
                      task.position = index;
                    }
                  });
                });
              });
            }

            newLists.push(new List(list));
          });

          List.create(newLists, function (error, lists) {
            if (error) {
              return callback(error);
            }

            _.each(boards, function (board) {
              Board.update(
                {
                  _id: board._id
                },
                {
                  $set: {
                    lists: boardLists[board._id] || [],
                  }
                },
                function (error, board) {
                  //
                }
              );
            });

            callback(null, lists, boards, project, nodes, changeLog);
          });
        });
    }

    function cloneRacis(lists, boards, project, nodes, changeLog, callback) {
      var newRacis = [];
      Raci
        .find({
          project: clonedProjectId,
        })
        .exec(function (error, racis) {
          if (error) {
            return callback(error);
          }

          if (!racis) {
            callback(null);
          }

          _.each(racis, function (raci) {
            raci = raci.toJSON ? raci.toJSON() : raci;
            delete raci.__v;
            _.each(changeLog, function (log) {
              if (log.originalId == String(raci.node)) {
                raci.node = ObjectId(log.newId);
              }
            });

            raci._id = new ObjectId();
            raci.project = ObjectId(project._id);

            newRacis.push(new Raci(raci));
          });

          Raci.create(newRacis, function (error, racis) {
            if (error) {
              return callback(error);
            }

            return callback(null);
          });
        });
    }
  }
});

app.get('/api/project/:id/image', function (req, res, next) {
  amazon
    .get_url('projects', 'image', req.params.id)
    .then(function (url) {
      res.redirect(url);
    })
    .catch(function (error) {
      res.status(404).send('Not found');
    });
});

app.post('/api/project/:id/image', multipart, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  var image = req.files && req.files.image;
  var project_id = req.params.id;
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

  amazon
    .upload('projects', 'image', project_id, file)
    .then(function (url) {
      api_response(null, url);

      Project.findById(project_id, function (error, project) {
        if (error) {
          return;
        }

        project.has_image = true;
        project.save();
      });
    })
    .catch(function (error) {
      api_response(error);
    });
});

app.get('/api/project/:id/raci', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var options = {
    project: req.params.id,
    $or: [
      {
        type: 'raci_tab'
      },
      {
        type: 'raci_view'
      }
    ]
  };

  Raci
    .find(options)
    .populate('node')
    .exec(function (error, docs) {
      api_response(error, docs);
    });
});

function addRaci(req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  Project.findOne({
    _id: req.params.project_id,
    _user: req.user._id
  }, function (err, project) {
    if (!project && !req.body.allowCollaborator) {
      return generateResponse('Forbidden');
    }

    var details = {
      project: req.params.project_id,
      resource: req.body.resource,
      type: req.body.type
    };

    if (req.body.node) {
      details.node = req.body.node;
    }

    if (req.body.role) {
      details.role = req.body.role;
    }

    var raci = new Raci(details);
    raci.save(function (error, raci) {
      if (error) {
        return generateResponse(error);
      }

      raci.populate('node', function(error, raci) {
        var activity = new Activity({
          action: 'activityFeed.addRaci',
          project: raci.project,
          user: req.user._id,
          node: raci.node._id,
          nodeTitle: raci.node.title,
          raci: raci._id
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.addRaci(raci, req.user._id);

        generateResponse(null, raci);
      });
    });

  });

}

app.put('/api/project/:project/raci/:raci', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.findOne({
    _id: req.params.project,
    _user: req.user._id
  }, function (err, project) {
    if (!project) {
      return api_response('Forbidden');
    }

    var payload = req.body;
    var update = {};
    var query = {
      _id: req.params.raci,
      project: req.params.project
    };

    if (payload.role) {
      update.role = payload.role;
    }

    if (payload.node) {
      update.node = payload.node;
    }

    Raci.update(query, update, function (error) {

      Raci.findById(req.params.raci, function(error, raci){
        raci.populate('node', function(error, raci) {
          var activity = new Activity({
            action: 'activityFeed.updateRaciRole',
            project: req.params.project,
            user: req.user._id,
            node: raci.node._id,
            nodeTitle: raci.node.title,
            resource: raci.resource
          });
          activity.save(function (error) {});
        });
      });

      // Send socket.io message.
      socket.updateRaciRole(req.params.project, req.params.raci, req.user._id);

      api_response(error);
    });
  });

});

app.delete('/api/project/:project/resource/:resource', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.findOne({
    _id: req.params.project,
    _user: req.user._id
  }, function (err, project) {
    if (!project) {
      return api_response('Forbidden');
    }

    var query = {
      project: req.params.project,
      resource: req.params.resource
    };

    Raci.remove(query, function (error) {
      var activity = new Activity({
        action: 'activityFeed.removeResource',
        project: req.params.project,
        user: req.user._id,
        resource: req.params.resource
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.removeResource(req.params.project, req.params.resource, req.user._id);

      api_response(error);
    });
  });

});

app.delete('/api/project/:project/raci/:raci', secure.auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.findOne({
    _id: req.params.project,
    _user: req.user._id
  }, function (err, project) {
    if (!project) {
      return api_response('Forbidden');
    }

    Raci.findById(req.params.raci, function (error, raci) {
      if (error) {
        return api_response(error);
      }

      if (!raci) {
        return api_response('raci does\'t exist');
      }

      raci.remove(function (error) {
        api_response(error);
      });
    });

  });

});

app.get('/api/project/demo/get_users/:id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Project.find({
    _user: ObjectId(req.params.id),
    isDemo: true
  }, function (error, projects) {
    api_response(error, projects[0]);
  });
});

app.get('/api/project/:id/export-as-ms-project', exportAsMSProject);

function exportAsMSProject (req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  // The project ID to update.
  var projectId = req.params.id;

  // Create a Aspose Cloud instance.
  var aspose = new AsposeCloud({
    appSID: config.get('aspose').appSID,
    appKey: config.get('aspose').appKey,
    baseURI: config.get('aspose').baseURI,
  });

  // Copy and rename a blank MPP file.
  var tempFilePath = APP_PATH + '.tmp/ms-project/' + projectId + '.mpp';
  copyFile(APP_PATH + 'blank.mpp', tempFilePath, function (error) {
    if (error) {
      console.error('Failed to copy a blank MPP file.');
      return generateResponse('Internal Server Error');
    }

    // Upload a blank MPP file to Aspose Cloud.
    var asposeStorage = aspose.Storage();
    asposeStorage.uploadFile(tempFilePath, '', '', function (data) {
      if (data.Code != 200) {
        console.error('Failed to upload a blank MPP file.');
        return generateResponse('Internal Server Error');
      }

      Node
        .find({
          _project: projectId,
          _parent: null,
        })
        .populate({
          path: '_nodes',
          options: {
            sort: 'position',
          },
        })
        .populate({
          path: '_dependency.node',
          select: 'title _id'
        })
        .sort('position')
        .exec(function (error, docs) {
          if (error) {
            return generateResponse(error);
          }

          var nodesPath = '_nodes';
          var parentPath = '_parent';
          var depPath = '_dependency.node';

          populateNodes(docs, nodesPath, depPath, parentPath, 1, function (error, nodes) {
            if (error) {
              return generateResponse(error);
            }

            var syncTasks = [];
            _.each(nodes, function (node) {
              addNodeAsTask(projectId, node, syncTasks);
            });

            function addNodeAsTask(projectId, node, syncTasks) {
              syncTasks.push(function (callback) {
                asposeTasks.addTask(projectId + '.mpp', encodeURI(node.title), '', function (data) {
                  callback(null, data);
                });
              });

              if (node._nodes.length) {
                _.each(node._nodes, function (childNode) {
                  addNodeAsTask(projectId, childNode, syncTasks);
                });
              }
            }

            // Aspose doesn't support the parallel adding of tasks well.
            var asposeTasks = aspose.Tasks();
            async.series(syncTasks, function (error) {
              if (error) {
                return generateResponse(error);
              }

              asposeStorage.getFile(projectId + '.mpp', '', function (data) {
                amazon
                  .upload('projects', 'ms', projectId, data)
                  .then(function (url) {
                    // Delete the project file from Aspose Cloud.
                    // We don't need to wait until the file is deleted before sending response to end users.
                    asposeStorage.deleteFile(projectId + '.mpp', '', function (data) {
                      if (data.Code != 200) {
                        console.error('Failed to delete the project folder from Aspose Cloud: ' + projectId + '/' + fileName);
                      }
                    });

                    // Delete the local temporary file.
                    fs.unlink(tempFilePath);

                    generateResponse(null, {
                      path: '/api/data/ms-project/' + projectId
                    });
                  })
                  .catch(function (error) {
                    generateResponse(error);
                  });
              });
            });
          });
        });
    });

    function populateNodes(docs, nodesPath, depPath, parentPath, level, done) {
      nodesPath += '._nodes';
      parentPath = '_nodes.' + parentPath;
      depPath = '_nodes.' + depPath;

      var opts = [
        {
          path: nodesPath,
          options: {
            sort: 'position'
          }
        },
        {
          path: parentPath
        },
        {
          path: depPath,
          select: 'title _id'
        },
      ];

      Node.populate(docs, opts, function (error, nodes) {
        if (error) {
          return done(error);
        }

        if (level <= 10) {
          populateNodes(nodes, nodesPath, depPath, parentPath, level + 1, done);
        } else {
          done(null, nodes);
        }
      });
    }
  });
}

// Import tasks from a MS project file uploaded.
var uploadInfoMSProject = multer({
  dest: APP_PATH + '.tmp/ms-project',
});

app.post('/api/project/:id/import-ms-project', uploadInfoMSProject.single('file'), importMSProject);

function importMSProject(req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  // Ensure that the project file is uploaded successfully.
  if (_.isUndefined(req.file)) {
    console.error('The file is not uploaded correctly.');
    return generateResponse('Bad Request');
  }

  // The project ID to update.
  var projectId = req.params.id;

  // The temporary file path for MS project file uploaded.
  var filePath = req.file.path;
  var fileName = req.file.filename;

  // Create a Aspose Cloud instance.
  var aspose = new AsposeCloud({
    appSID: config.get('aspose').appSID,
    appKey: config.get('aspose').appKey,
    baseURI: config.get('aspose').baseURI,
  });

  // Create a folder for each project.
  var asposeStorage = aspose.Storage();

  // Check if the project's folder is already created.
  asposeStorage.fileExists(projectId, '', function (data) {
    if (data.Code != 200 || !data.FileExist.IsExist || !data.FileExist.IsFolder) {
      // Create a new folder for the project.
      asposeStorage.createFolder(projectId, '', function (data) {
        if (data.Code != 200) {
          console.error('Failed to create a folder on Aspose Cloud.');
          return generateResponse('Internal Server Error');
        }

        uploadProjectFile();
      });
    } else {
      // Go ahead without create any new folder.
      uploadProjectFile();
    }
  });

  // Upload the MS project file to the project folder on Aspose Cloud.
  function uploadProjectFile() {
    asposeStorage.uploadFile(filePath, projectId, '', function (data) {
      if (data.Code != 200) {
        console.error('Failed to upload the project file to Aspose Cloud.');
        return generateResponse('Internal Server Error');
      }

      // Read tasks from the project file.
      var asposeTasks = aspose.Tasks();
      asposeTasks.getTasks(fileName, projectId, function (tasks) {
        // Add a task for each MS project task found.
        _.each(tasks, function (task) {
          var node = new Node({
            title: task.Name,
            user: req.user._id,
            _project: projectId,
            start_date: parseMSProjectDateString(task.Start),
            end_date: parseMSProjectDateString(task.Finish),
          });

          node.save();
        });

        // Delete the project file from Aspose Cloud.
        // We don't need to wait until the file is deleted before sending response to end users.
        asposeStorage.deleteFile(projectId + '/' + fileName, '', function (data) {
          if (data.Code != 200) {
            console.error('Failed to delete the project folder from Aspose Cloud: ' + projectId + '/' + fileName);
          }
        });

        // Delete the local temporary file.
        fs.unlink(filePath);

        return generateResponse(null);
      });
    });
  }
}

/**
 * Parse date strings of MS project.
 * @param {String} dateString
 * @return {Date}
 */
function parseMSProjectDateString(dateString) {
  var timeString = dateString.substr(6);
  var plusPosition = timeString.indexOf('+');
  timeString = timeString.substr(0, plusPosition);

  var date = new Date();
  date.setTime(timeString);
  return date;
}

/**
 * Copy a file.
 * @param {String} source
 * @param {String} target
 * @param {Function} cb
 */
function copyFile(source, target, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(source);
  rd.on('error', function (error) {
    done(error);
  });

  var wr = fs.createWriteStream(target);
  wr.on('error', function (error) {
    done(error);
  });
  wr.on('close', function () {
    done();
  });

  rd.pipe(wr);

  function done(error) {
    if (!cbCalled) {
      cb(error);
      cbCalled = true;
    }
  }
}

app.get('/api/project/:id/activity/:page', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var projectId = req.params.id;
  var page = req.params.page;
  var pageSize = 20;
  var query = {
    project: projectId
  };
  // var options = {
  //   populate: 'user',
  //   sort:     {_id:-1},
  //   lean:     true,
  //   page:     page,
  //   limit:    pageSize
  // };

  // Activity
  //   .paginate(query, options, function (error, result) {
  //     api_response(error, result);
  //   });

  Activity
    .find(query)
    .populate('user')
    .limit(pageSize)
    .skip(pageSize * (page-1))
    .sort({_id:-1})
    .exec(function (error, docs) {
      Activity.count(query).exec(function (err, count) {
        var pageCount = Math.ceil(count/pageSize);
        api_response(error, {pageCount:pageCount, docs: docs});

      if (docs.length>0) {
        var activity = docs[0];
        var options = {
          multi: true
        };

        User.update({
          _id: req.user._id
        }, {
          $pull: {
            latestActivities: {
              project: projectId
            }
          }
        }, options, function (error, user) {

          User.update({
            _id: req.user._id
          }, {
            $push: {
              latestActivities: {
                project: projectId,
                activity: activity._id
              }
            }
          }, function (error, user) {
          });

        });
      }

      })
    });

});

app.get('/api/project/:project/last_activity', secure.auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Activity.findOne({project: req.params.project}, {}, {sort:{'_id':-1}},
  function (error, activity) {
 	  if (error) {
	    return api_response(error);
	  }
    api_response(null, {'last_activity': activity ? activity._id : undefined});
  });
});
