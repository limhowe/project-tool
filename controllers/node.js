var async = require('async');
var fs = require('fs');
var secure = Middlewares.secure;
var auth = Middlewares.secure.auth;
var User = Models.User;
var Project = Models.Project;
var Risk = Models.Risk;
var Raci = Models.Raci;
var Node = Models.Node;
var Activity = Models.Activity;
var mailer = Helpers.mailer();
var Api_Response = Middlewares.general.api_response;
var amazon = Helpers.amazon;
var multipart = Middlewares.general.multipart();
var translater = Helpers.translater;
var socket = Helpers.socket;
var ObjectId = require('mongoose').Types.ObjectId;
var _ = require('lodash');

app.put('/api/project/node/:id', auth, updateNode);
app.delete('/api/project/node/:id', auth, secure.hasProjectAccess, deleteNode);

var preloadNodes = function (project_id) {

    Project.findOne({
      _id: project_id
    })
    .exec(function (error, project) {
      if (error) {
        console.log('pass node ppp');
        return ;
      }
      if (!project) {
        console.log('pass node ppp2');
        return ;
      }

      completed = project.settings.hide_completed;

      var query = {
        _project: project_id,
        _parent: null
      };

      var populate_nodes_query = {
        path: '_nodes',
        options: {
          sort: 'position'
        }
      };

      if (completed) {
        query.complete = {
          $ne: 100
        };
        populate_nodes_query.match = {
          complete: {
            $ne: 100
          }
        };
      }

      Node
      .find(query)
      .populate(populate_nodes_query)
      .populate({
        path: '_dependency.node',
        select: 'title _id'
      })
      .sort('position')
      .exec(function (error, docs) {
      });
    })
}

function populate_nodes(docs, nodes_path, dep_path, parent_path, completed, level, done) {
  nodes_path += '._nodes';
  parent_path = '_nodes.' + parent_path;
  dep_path = '_nodes.' + dep_path;

  var opts = [
    {
      path: nodes_path,
      options: {
        sort: 'position'
      }
    },
    {
      path: parent_path
    },
    {
      path: dep_path,
      select: 'title _id'
    },
  ];

  if (completed) {
    opts[0].match = {
      complete: {
        $ne: 100
      }
    };
  }



  Node.populate(docs, opts, function (error, nodes) {
    if (error) {
      return done(error);
    }

    if (level <= 10) {
      populate_nodes(nodes, nodes_path, dep_path, parent_path, completed, level + 1, done);
    } else {
      done(null, nodes);
    }
  });
}

app.post('/api/project/nodes', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project;
  var completed;
  Project.findOne({
    _id: project_id,
    $or: [
      {
        '_users.user': req.user._id
      },
      {
        '_user': req.user._id
      }
    ]
  })
  .exec(function (error, project) {
    if (error) {
      return api_response(error);
    }
    if (!project) {
      return api_response('Project not found');
    }

    completed = req.body.completed || project.settings.hide_completed;

    var query = {
      _project: project_id,
      _parent: null
    };

    var populate_nodes_query = {
      path: '_nodes',
      options: {
        sort: 'position'
      }
    };

    if (completed) {
      query.complete = {
        $ne: 100
      };
      populate_nodes_query.match = {
        complete: {
          $ne: 100
        }
      };
    }

    Node
    .find(query)
    .populate(populate_nodes_query)
    .populate({
      path: '_dependency.node',
      select: 'title _id'
    })
    .sort('position')
    .exec(function (error, docs) {
      if (error) {
        return api_response(error);
      }

      var nodes_path = '_nodes';
      var parent_path = '_parent';
      var dep_path = '_dependency.node';

      populate_nodes(docs, nodes_path, dep_path, parent_path, completed, 1, function (error, nodes) {
        api_response(error, {
          nodes: nodes
        });
      });
    });
  })
});

/**
 * Create a new root task.
 */

function addRootNode(project_id, node_data, user, done) {

  Project.findById(project_id,
    function onProjectFind(error, project) {
      if (error) {
        return done(error);
      }

      if (!project) {
        return done('Project not found.');
      }

      var node = new Node({
        title: node_data.title,
        user: user._id,
        _project: project._id,
      });

      // Assign task ID.
      // Task IDs are incremental, prefixed by the first letter of project names.
      var taskId = 1;
      if (typeof project.last_task_id !== 'undefined') {
        taskId = project.last_task_id + 1;
      }
      node.set('task_id', project.name[0] + '-' + taskId);

      // Save the last task ID.
      project.set('last_task_id', taskId);
      project.save();

      node.save(function (error) {
        if (error) {
          return done(error);
        }

        done(null, node);
      });
    });
}

app.post('/api/project/node/add_root', auth, function (req, res, next) {

  var generateResponse = Api_Response(req, res, next);
  var user = req.user;

  addRootNode(req.body.project_id, req.body.node_data, user, function(error, node) {
    if (error) {
      return generateResponse(error);
    }

    var activity = new Activity({
      action: 'activityFeed.addTask',
      project: node._project,
      user: user._id,
      node: node._id,
      nodeTitle: node.title
    });
    activity.save(function (error) {});

    // Send socket.io message.
    socket.createNewTask(node);

    generateResponse(null, {
      node: node
    });

    preloadNodes(node._project);
  });
});

/**
 * Create a new sub-task.
 */


function addNode(parent_id, node_data, user, done) {

  Node.findById(parent_id, function (error, parent_node) {
    if (error) {
      return done(error);
    }

    if (!parent_node) {
      return done('This parent node doesn\'t exist');
    }

    // Assign task ID.
    // Task IDs are incremental, prefixed by parent task IDs.
    var taskId = 1;
    if (typeof parent_node.last_task_id !== 'undefined') {
      taskId = parent_node.last_task_id + 1;
    }

    var node = new Node({
      title: node_data.title,
      user: user._id,
      _parent: parent_node._id,
      level: parent_node.level + 1,
      path: (parent_node.path) ? (parent_node.path + ',' + parent_node._id) : parent_node._id,
      _project: parent_node._project,
      task_id: parent_node.task_id + '.' + taskId,
    });

    // Save the last task ID.
    parent_node.set('last_task_id', taskId);
    parent_node.save();

    node.save(function (error) {
      if (error) {
        return done(error);
      }

      parent_node._nodes.unshift(node._id);
      parent_node.save(function (err) {});

      done(null, node, parent_node);

    });
  });
}

app.post('/api/project/node/add', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var node_data = req.body.node_data;

  addNode(req.body.parent_id, node_data, req.user, function(error, node, parent_node) {
    if (error) {
      return api_response(error);
    }

    if (parent_node) {
      node._parent = parent_node;
    }
    //Node.populate(node, [{
    //  path: '_parent'
    //}], function (error, node) {

      var activity = new Activity({
        action: 'activityFeed.addTask',
        project: node._project,
        user: req.user._id,
        node: node._id,
        nodeTitle: node.title
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.createNewTask(node);

      api_response(null, {
        node: node
      });

      preloadNodes(node._project);

    //});
  });
});

/**
 * clone task
 */

app.post('/api/project/node/:id/clone', secure.auth, secure.hasProjectAccess, function (req, res, next) {

  var generateResponse = Api_Response(req, res, next);
  var project_id = req.body.project_id;

  var user = req.user;

  var node_id = req.params.id;
  if (req.body.parent_id) {
    console.log('Clonning with parent Node');
    cloneNode(project_id, req.body.parent_id, node_id);
  } else {
    console.log('Clonning with Project');
    cloneRootNode(project_id, node_id);
  }

  function generateClonedNode(node_id) {
    var populate_nodes_query = {
      path: '_nodes',
      options: {
        sort: 'position'
      }
    };

    Node
    .findById(node_id)
    .populate('_parent')
    .populate(populate_nodes_query)
    .populate({
      path: '_dependency.node',
      select: 'title _id'
    })
    .sort('position')
    .exec(function (error, docs) {
      if (error) {
        return generateResponse(error);
      }

      var nodes_path = '_nodes';
      var parent_path = '_parent';
      var dep_path = '_dependency.node';

      populate_nodes(docs, nodes_path, dep_path, parent_path, false, 1, function (error, nodes) {
        generateResponse(error, {
          node: nodes
        });
      });
    });
  }

  function cloneRootNode(project_id, node_id) {

    Node.findById(node_id, function (error2, orgNode) {
      if (error2) {
        return generateResponse(error2);
      }

      if (!orgNode) {
        return generateResponse('Node not found.');
      }

      addRootNode(project_id, {
        title: orgNode.title + 'copy'
      }, user, function (error, newNode) {
        processCloning(project_id, orgNode,newNode, function() {

          var activity = new Activity({
            action: 'activityFeed.addTask',
            project: newNode._project,
            user: user._id,
            node: newNode._id,
            nodeTitle: newNode.title
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.createNewTask(newNode);

          generateClonedNode(newNode._id);
        });
      });
    });
  }

  function cloneNode(project_id, parent_id , node_id) {

    Node.findById(node_id, function (error2, orgNode) {
      if (error2) {
        return generateResponse(error2);
      }

      if (!orgNode) {
        return generateResponse('Node not found.');
      }

      addNode(parent_id, {
        title: orgNode.title + ' copy'
      }, user, function (error, newNode) {
        processCloning(project_id,orgNode, newNode, function() {

          var activity = new Activity({
            action: 'activityFeed.addTask',
            project: newNode._project,
            user: user._id,
            node: newNode._id,
            nodeTitle: newNode.title
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.createNewTask(newNode);

          generateClonedNode(newNode._id);
        });
      });
    });

  }

  function processCloning(project_id,orgNode, newNode, callback) {

    var oldNodes = [];
    var newNodes = [];
    var changeLog = [];

    //Process copy
    //
    if (orgNode.agile_status) {
      newNode.set('agile_status', orgNode.agile_status);
    }

    if (orgNode.agile_board) {
      newNode.set('agile_board', orgNode.agile_board);
    }

    if (orgNode.notes) {
      newNode.set('notes', orgNode.notes);
    }

    if (orgNode.start_date) {
      newNode.set('start_date', orgNode.start_date);
    }

    if (orgNode.end_date) {
      newNode.set('end_date', orgNode.end_date);
    }

    if (orgNode.cost) {
      newNode.set('cost', orgNode.cost);
    }

    if (orgNode._quality && orgNode._quality.length) {
      var newQuality = [];
      _.each(orgNode._quality, function (quality) {
        quality._id = new ObjectId();
        newQuality.push(quality);
      });
      newNode._quality = newQuality;
    }

    if (orgNode.files && orgNode.files.length) {
      var newFiles = [];
      _.each(orgNode.files, function (file) {
        file._id = new ObjectId();
        newFiles.push(file);
      });
      newNode.files = newFiles;
    }

    if (orgNode.assigned_users && orgNode.assigned_users) {
      var newAssignedUsers = [];
      _.each(orgNode.assigned_users, function (user) {
        user._id = new ObjectId();
        newAssignedUsers.push(user);
      });
      newNode.assigned_users = newAssignedUsers;
    }

    if (orgNode._dependency && orgNode._dependency.length) {
      var newDependency = [];
      _.each(orgNode._dependency, function (dependency) {
        dependency._id = new ObjectId();
        newDependency.push(dependency);
      });

      newNode._dependency = newDependency;
    }

    newNode._state = orgNode._state;
    newNode.complete = orgNode.complete;


    //Cloning child tasks

    var node_id = orgNode._id;
    var where = {
      _project: project_id,
      path: new RegExp(orgNode._id+'(?:,|$)', "i")
    };

    Node.find(where).snapshot(true).exec(function (err, docs) {

      if (docs) {
        _.each(docs,function(item){
          oldNodes.push(item);
        });
      }


      var rootChildNodes = [];
      // Clone nodes and log ID changes.
      _.each(oldNodes, function (node) {
        var originalId = node._id;

        // console.log('oldNode : ' + originalId);

        node._id = new ObjectId();

        if (node._quality && node._quality.length) {
          _.each(node._quality, function (quality) {
            quality._id = new ObjectId();
          });
        }

        if (node._files && node._files.length) {
          _.each(node._files, function (file) {
            file._id = new ObjectId();
          });
        }

        if (node.assigned_users && node.assigned_users) {
          _.each(node.assigned_users, function (user) {
            user._id = new ObjectId();
          });
        }

        if (String(node._parent) == String(orgNode._id)) {
          node._parent = newNode._id;
        }

        var nodeToPush = new Node(node);

        if (nodeToPush._parent == newNode._id) {
          rootChildNodes.push(nodeToPush);
        }

        newNodes.push(nodeToPush);

        changeLog.push({
          originalId: String(originalId),
          newId: String(nodeToPush._id),
        });
      });

      //setChild node to New Node
      newNode._nodes = rootChildNodes;

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

        var logNode = _.find(changeLog, {newId : String(node._id) });
        var originalNodeId = logNode.originalId;

        var childNodes = [];
        if (node._nodes && node._nodes.length) {
          _.each(node._nodes, function (childNodeId) {
            var log = _.find(changeLog, {originalId : String(childNodeId) });
            childNodes.push(ObjectId(log.newId));
          });
        }

        newNodes[index]._nodes = childNodes;

        if (node._parent) {
          var log = _.find(changeLog, {originalId : String(node._parent) });
          if (log) {
            newNodes[index]._parent = ObjectId(log.newId);
          }
        }
      });

      newNodes.push(newNode);
      updateChildTaskIdAndPathToCloneNode(newNode);
      //pop root Node from list
      newNodes.pop();

      newNode.save(function (error) {
        if (error) {
          console.log(error);
          return generateResponse(error);
        }

        Node.create(newNodes, function (error, nodes) {

          console.log(error);
          if (error) {
            return generateResponse(error);
          }

          callback();
        });
      });

    });

    function updateChildTaskIdAndPathToCloneNode (node) {
      var task_id = node.task_id;

      if (node._nodes && node._nodes.length) {
        _.each(node._nodes, function (childNodeId) {
          var childNode = _.find(newNodes, function(o) { return String(o._id) == String(childNodeId); });

          if (!childNode) {
            console.log('can\'t find child node ', ':' , childNodeId)
            return;
          }

          var child_task_id = childNode.task_id.split('.').pop();
          childNode.set('task_id',task_id + '.' + child_task_id);

          var position_path = node.position_path ? node.position_path + '#' : '';
          position_path += String(node._id) + ',' + node.position;
          var path = ((node.path) ? (node.path + ',' + node._id) : node._id);

          childNode.set('position_path',position_path);
          childNode.set('path',path);

          updateChildTaskIdAndPathToCloneNode(childNode);
        });
      }
    }
  }

});

app.put('/api/project/node/:id/parent', auth, secure.hasProjectAccess,  function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var parent_id = req.body.parent_id;

  Node.findById(req.params.id, function (error, node) {
    if (error) {
      return api_response(error);
    }

    if (!node) {
      return api_response('Node doesn\'t exist');
    }

    Node.findById(parent_id, function (error, parent_node) {
      if (error) {
        return api_response(error);
      }

      if (!parent_node && parent_id) {
        return api_response('This parent task doesn\'t exist');
      }

      var old_parent_id = node.get('_parent');

      if (parent_node) {
        node.set('_parent', parent_node._id);
        node.set('level', parent_node.level + 1);
        node.set('path', ((parent_node.path) ? (parent_node.path + ',' + parent_node._id) : parent_node._id))
      } else {
        node.set('_parent', undefined);
        node.set('level', 1);
        node.set('path', null);
      }

      Node.getFreePosition(parent_id, node._project, function (error, next_position) {
        var path = null;
        if (parent_id) {
          path = parent_node.position_path ? parent_node.position_path + '#' : '';
          path += parent_node.id + ',' + parent_node.position;
        }

        node.set('position', next_position);
        node.set('position_path', path);

        node.save(function (error) {
          if (error) {
            return api_response(error);
          }

          if (parent_id != old_parent_id && parent_node) {
            parent_node._nodes.push(node._id);
            parent_node.save(function (err) {});
          }

          Node.updateChildPositionPath(node, node._project, function () {});
          Node.updateChildPositions(old_parent_id, node._project);

          Node.findById(node._id)
          .populate('_parent')
          .exec(function (error, node) {
            if (error) {
              api_response(error);
            } else {
              api_response(null, { node: node });
            }
          });

          if (parent_id != old_parent_id) {
          Node.findById(old_parent_id, function (error, old_parent) {
            if (!old_parent) {
              return;
            }

            old_parent._nodes.pull(node._id);
            old_parent.save(function (error) {});
          });
          }

        });
      });
    });
  });
});

app.post('/api/project/node/:id/position', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Node.changePosition(req.params.id, req.body.position)
  .then(function (node) {
    var activity = new Activity({
      action: 'activityFeed.updateNodePosition',
      project: node._project,
      user: req.user._id,
      node: node._id,
      nodeTitle: node.title
    });
    activity.save(function (error) {});

    // Send socket.io message.
    socket.updateNodePosition(node._project, node._id, req.params.position, req.user._id);

    api_response(null, node);
  })
  .catch(function (error) {
    api_response(error || 'couldn\'t change position');
  });
});

/**
 * Update node.
 */
function updateNode(req, res, next) {
  var api_response = Api_Response(req, res, next);
  var node_data = req.body.node_data;

  Node.findById(req.params.id)
  .populate('user')
  .exec(function (error, node) {
    if (error) {
      return api_response(error);
    }

    if (!node) {
      return api_response('Task doesn\'t exist');
    }

    if (node_data.title) {
      node.set('title', node_data.title);
    }

    if (node_data.agile_status) {
      node.set('agile_status', node_data.agile_status);
    }

    if (node_data.agile_board) {
      node.set('agile_board', node_data.agile_board);
    }

    if (node_data.notes) {
      node.set('notes', node_data.notes);
    }

    if (node_data.start_date) {
      node.set('start_date', node_data.start_date);
    }

    if (node_data.end_date) {
      node.set('end_date', node_data.end_date);
    }

    if (node_data.duration) {
      node.set('duration', node_data.duration);
    }

    if (node_data.optimisticTime) {
      node.set('optimisticTime', node_data.optimisticTime);
    }

    if (node_data.pessimisticTime) {
      node.set('pessimisticTime', node_data.pessimisticTime);
    }

    if (node_data.mostLikelyTime) {
      node.set('mostLikelyTime', node_data.mostLikelyTime);
    }

    if (node_data.cost) {
      node.set('cost', node_data.cost);
    }

    if (!_.isUndefined(node_data.complete)) {
      node.set('complete', node_data.complete);

      if (node.complete == 100 && node.user
         && node.user._id.toString() != req.user._id.toString()) {

        mailer.send({
          to: [{
            email: node.user.email
          }],
          subject: translater.translate('The Task You Created "$[1]" is completed', node.user.language, [ node.title ])
        }, {
          name: 'task/complete',
          language: node.user.language,
          params: {
            domain: config.get('domain'),
            node: node
          }
        }, function () { /* silence */ });
      }
    }

    if (node_data.state) {
      node.updateState(node_data.state, function (error) {
        node.save(function (error) {
          if (!error) {
            var activity = new Activity({
              action: 'activityFeed.updateTask',
              project: node._project,
              user: req.user._id,
              node: node._id,
              nodeTitle: node.title
            });
            activity.save(function (error) {});

            // Send socket.io message.
            socket.updateTask(node, req.user._id);
          }
          api_response(error);
        });
      })
    } else {
      node.save(function (error) {
        if (!error) {
          var activity = new Activity({
            action: 'activityFeed.updateTask',
            project: node._project,
            user: req.user._id,
            node: node._id,
            nodeTitle: node.title
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.updateTask(node, req.user._id);
        }
        api_response(error);
      });
    }
  });
}

/**
 * Delete a task.
 */
function deleteNode(req, res, next) {
  var nodeId = req.params.id;
  var generateResponse = Api_Response(req, res, next);

  Node.findById(nodeId, function (error, node) {
    if (error || !node) {
      return generateResponse(error);
    }

    var projectId = node._project;
    var parentId = node._parent;
    var nodeIdObjectId = node._id;

    if (parentId) {
      Node.findById(parentId, function (error1, parent_node) {

        if (error1) {
          return generateResponse(error1);
        }

        node.remove(function (error) {
          if (error) {
            return generateResponse(error);
          }

          if(parent_node._nodes.indexOf(nodeIdObjectId) != -1){
            parent_node._nodes.splice(parent_node._nodes.indexOf(nodeIdObjectId), 1);
          }
          parent_node.save(function (err) {});

          var activity = new Activity({
            action: 'activityFeed.deleteTask',
            project: projectId,
            user: req.user._id,
            node: nodeId,
            nodeTitle: node.title
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.deleteTask(node, req.user._id);

          generateResponse(null);
        });
      });
    } else {
      node.remove(function (error) {
        if (error) {
          return generateResponse(error);
        }

        var activity = new Activity({
          action: 'activityFeed.deleteTask',
          project: projectId,
          user: req.user._id,
          node: nodeId,
          nodeTitle: node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.deleteTask(node, req.user._id);

        generateResponse(null);
      });
    }

    var options = {
      multi: true
    };

    Node.update({ _project: projectId }, {
      $pull: {
        _dependency: {
          node: nodeId
        }
      }
    }, options).exec();
  });
}

app.get('/api/project/node/:id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Node
    .findOne({
      _id: req.params.id
    })
    .populate('_dependency.node')
    .populate('_nodes')
    .populate('assigned_users.user')
    .exec(function (error, node) {
      if (error) {
        return api_response(error);
      }

      if (!node) {
        return api_response('Node doesn\'t exists');
      }

      api_response(null, {
        node: node
      });
    });
});

app.post('/api/project/node/searchByTitle', auth, secure.hasProjectAccess, function (req, res, next) {
  var query = {
    _project: req.body.project_id,
    title: new RegExp(req.body.q, 'i')
  };
  var api_response = Api_Response(req, res, next);

  Node.find(query, {
    title: 1,
    _id: 1
  }, function (error, nodes) {
    api_response(error, nodes);
  });
});

/**
 * Add a dependency to task.
 */
app.post('/api/project/node/:id/dependency', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var successorId = req.params.id;
  var predecessorId = req.body.id;
  var type = req.body.type;

  if (successorId === predecessorId) {
    return api_response('you can\'t add same task as dependency');
  }

  var options = {
    _id: predecessorId,
    '_dependency.node': successorId,
    '_dependency.type': type
  };

  Node.findOne(options, function (error, node) {
    if (error) {
      return api_response(error);
    }

    if (node) {
      return api_response('dependency already exists');
    }

    options = {
      $push: {
        _dependency: {
          node: successorId,
          type: type
        }
      }
    };

    Node.update({
      _id: predecessorId
    }, options, function (error) {
      if (error) {
        return api_response(error);
      }

      Node.findById(predecessorId, function (error, predecessor) {
        if (error) {
          return;
        }

        Node.findById(successorId, function (error, successor) {
          if (error) {
            return;
          }

          var activity = new Activity({
            action: 'activityFeed.addDependency',
            project: predecessor._project,
            user: req.user._id,
            node: predecessor._id,
            nodeTitle: predecessor.title
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.addDependency(predecessor, successor, type, req.user._id);
        });
      });

      api_response(null);
    });
  });
});

/**
 * Delete a dependency from task.
 */
app.delete('/api/project/node/:id/dependency/:dep_id/:type', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  var nodeId = req.params.id;
  var dependencyTaskId = req.params.dep_id;
  var type = req.params.type;

  var options = {
    $pull: {
      _dependency : {
        node: dependencyTaskId,
        type: type,
      }
    }
  };

  Node.update({
    _id: nodeId
  }, options, function (error) {
    if (error) {
      return api_response(error);
    }

    Node.findById(nodeId, function (error, node) {
      if (error) {
        return;
      }

      var activity = new Activity({
        action: 'activityFeed.deleteDependency',
        project: node._project,
        user: req.user._id,
        node: node._id,
        nodeTitle: node.title
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.deleteDependency(node, dependencyTaskId, type, req.user._id);
    });

    api_response(null);
  });
});

/**
 * Add a quality to task.
 */
app.post('/api/project/node/:id/quality', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var nodeId = req.params.id;
  var options = {
    $push: {
      _quality: req.body
    }
  };

  Node.update({
    _id: nodeId
  }, options, function (error, data) {
    if (error) {
      return api_response(error);
    }

    Node.findById(nodeId, function (error, node) {
      if (error) {
        return api_response(error);
      }

      var activity = new Activity({
        action: 'activityFeed.addQuality',
        project: node._project,
        user: req.user._id,
        node: node._id,
        nodeTitle: node.title,
        quality: req.body.text
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.addQuality(node, req.user._id);

      api_response(null, node);
    });
  });
});

app.put('/api/project/node/:node_id/quality/:id', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var node_id = req.params.node_id;
  var qualityId = req.params.id;
  var completed, text;

  if (!_.isUndefined(req.body.completed) && req.body.completed !== null) {
    completed = req.body.completed;
  }

  if (!_.isUndefined(req.body.text) && req.body.text !== null) {
    text = req.body.text;
  }

  if (completed || completed === false) {
    var options = {
      $set: {
        '_quality.$.completed': completed
      }
    };
    Node.update({
      '_quality._id': qualityId
    }, options, function (error, data) {
      if (error) {
        return api_response(error);
      }

      Node.findById(node_id, function (error, node) {
        if (error) {
          return api_response(error);
        }

        var activity = new Activity({
          action: 'activityFeed.updateQuality',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.updateQuality(node, req.user._id);

        api_response(null, node);
      });
    });
  };

  if (!text) {
    return;
  }

  var options = {
    $set: {
      '_quality.$.text': text
    }
  };

  Node.update({
    '_quality._id': qualityId
  }, options, function (error, data) {
    if (error) {
      return api_response(error);
    }

    Node.findById(node_id, function (error, node) {
      if (error) {
        return api_response(error);
      }

      var activity = new Activity({
        action: 'activityFeed.updateQuality',
        project: node._project,
        user: req.user._id,
        node: node._id,
        nodeTitle: node.title
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.updateQuality(node, req.user._id);

      api_response(null, node);
    });
  });
});

/**
 * Delete a quality from task.
 */
app.delete('/api/project/node/:node_id/quality/:id', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var nodeId = req.params.node_id;
  var qualityId = req.params.id;

  var options = {
    $pull: {
      _quality: {
        _id: qualityId
      }
    }
  };

Node.findOne({'_id':ObjectId(nodeId), '_quality._id':ObjectId(qualityId)}, {'_quality.$.': 1}, function (error, node) {
  var quality = node._quality[0].text;

  Node.update({
    _id: nodeId
  }, options, function (error) {
    if (error) {
      return api_response(error);
    }

    Node.findById(nodeId, function (error, node) {
      if (error) {
        return;
      }

      var activity = new Activity({
        action: 'activityFeed.deleteQuality',
        project: node._project,
        user: req.user._id,
        node: node._id,
        nodeTitle: node.title,
        quality: quality
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.deleteQuality(node, req.user._id);
    });

    api_response(null);
  });
});

});

app.post('/api/project/node/:id/risk', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var data = req.body;
  data.node = req.params.id;

  var risk = new Risk(data);

  risk.save(function (error) {
    if (error) {
      return api_response(error);
    }

    Node.update(query, changes, opt, function (error) {
      error ? api_response(error) : api_response(null, risk);
    });
  });
});

app.delete('/api/project/node/:node_id/risk/:risk_id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Risk.findById(req.params.risk_id, function (error, risk) {
    if (error) {
      return api_response(error);
    }

    if (!risk) {
      return api_response('could not find risk');
    }

    risk.remove(api_response);
  });
});

app.post('/api/user/unassign/', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var email = req.body.email;
  var node_id = req.body.node;

  if (!Iz(email).email().valid) {
    return api_response('Please provide valid email address');
  }

  async.parallel({
    user: function (callback) {
      User
        .findOne({
          email: email
        })
        .exec(callback);
    },
    node: function (callback) {
      Node.findById(node_id).populate('assigned_users.user').exec(callback);
    }
  }, function (error, results) {
    if (error) {
      return api_response(error);
    }

    if (!results.node) {
      return api_response('Node not found');
    }

    var query;

    var user = results.user;
    if (user) {
      query = {
        $pull: {
          assigned_users: {
            user: user._id
          }
        }
      };
    } else {
      query = {
        $pull: {
          assigned_users: {
            invite_email: email
          }
        }
      };
    }

    Node
      .update({
        _id: node_id
      }, query)
      .exec(function (error) {
        results.node.assigned_users = _.reject(results.node.assigned_users, function (assignedUser) {
          if (user && assignedUser.user) {
            return String(assignedUser.user._id) == String(user._id);
          } else {
            return assignedUser.invite_email == email;
          }
        });

        var activity = new Activity({
          action: 'activityFeed.updateTaskAssignment',
          project: results.node._project,
          user: req.user._id,
          node: results.node._id,
          nodeTitle: results.node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.updateTaskAssignment(results.node, req.user._id);

        api_response(error);
      });
  });
});

/**
 * Assign task to users.
 */
app.post('/api/user/assign/', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var email = req.body.email;
  var node_id = req.body.node;

  if (!Iz(email).email().valid) {
    return api_response('Please provide valid email address');
  }

  async.parallel({
    user: function (callback) {
      User
        .findOne({
          email: email
        })
        .exec(callback);
    },
    node: function (callback) {
      Node.findById(node_id).populate('assigned_users.user').exec(callback);
    }
  }, function (error, results) {
    if (error) {
      return api_response(error);
    }

    var user = results.user;
    var node = results.node;

    if (!node) {
      return api_response('Node not found');
    }

    if (
      (user && _.findWhere(node.assigned_users, { user: { email: email } }))
            || _.findWhere(node.assigned_users, { invite_email: email })
    ) {
      return api_response('User already assigned to task');
    }

    var userData = {
      referral: req.user._id
    };

    if (user) {
      userData.user = user._id;
    } else {
      userData.invite_email = email;
    }

    node.assigned_users.push(userData);

    mailer.send({
      to: [{
        email: email
      }],
      subject: "You have been assigned a task"
    }, {
      name: 'task/assign',
      language: user ? user.language : req.user.language,
      params: {
        domain: config.get('domain'),
        is_registered: user ? true : false,
        user: req.user,
        node: node,
        email: email
      }
    });

    node.save(function (error) {
      if (!error) {
        var activity = new Activity({
          action: 'activityFeed.updateTaskAssignment',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.updateTaskAssignment(node, req.user._id);
      }
      api_response(error);
    });
  });
});

app.post('/api/node/searchByTitle', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  var query = {
    title: new RegExp(req.body.q, 'i'),
    _project: req.body.project
  };

  Node.find(query, {
    title: 1,
    _id: 1
  }, function (error, docs) {
    api_response(error, docs);
  });
});

/**
 * Upload a file from third-party storage services, like Google Drive.
 */
app.post('/api/project/node/:id/file', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var nodeId = req.params.id;
  var options = {
    $push: {
      _files: req.body
    }
  };

  Node.update({_id: nodeId}, options, function (error) {
    if (!error) {
      Node.findById(nodeId, function (error, node) {
        if (error) {
          return;
        }
        // Update fileObj with db _id
        fileObj = node._files.slice(-1).pop();
        api_response(null, fileObj);

        var activity = new Activity({
          action: 'activityFeed.uploadTaskFile',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.uploadTaskFile(node, req.body, req.user._id);
      });
    } else {
      api_response(error);
	}
  });
});

/**
 * Upload a file.
 */
app.post('/api/project/node/:id/upload', auth, multipart, function (req, res, next) {
  var apiResponse = Api_Response(req, res, next);
  var nodeId = req.params.id;

  if (!req.files || !req.files.file) {
    return apiResponse('Please provide a file to upload.');
  }

  var fileObj = req.files.file;
  var file = fs.readFileSync(fileObj.path);
  var now = new Date();

  // Upload to S3 bucket.
  amazon
    .upload('nodes', 'file', nodeId + '-' + now.getTime() + '-' + fileObj.name, file)
    .then(function (url) {
      // Update the node to add a file.
      var fileData = {
        from: 's3',
        name: fileObj.name,
        link: url,
        bytes: fileObj.size
      };

      var options = {
        $push: {
          '_files': fileData
        }
      };

      Node.update({ _id: nodeId }, options, function (error) {
        if (error) {
          apiResponse(error);
        } else {
          Node.findById(nodeId, function (error, node) {
            if (error) {
              return;
            }
			// Update fileObj with db _id
            fileObj = node._files.slice(-1).pop();
            apiResponse(null, fileObj);

            var activity = new Activity({
              action: 'activityFeed.uploadTaskFile',
              project: node._project,
              user: req.user._id,
              node: node._id,
              nodeTitle: node.title
            });
            activity.save(function (error) {});

            // Send socket.io message.
            socket.uploadTaskFile(node, fileObj, req.user._id);
          });

        }
      });

    })
    .catch(function (error) {
      apiResponse(error);
    });
});

/**
 * Delete a file uploaded.
 */
app.delete('/api/project/node/:node_id/file/:file_id', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var nodeId = req.params.node_id;
  var fileId = req.params.file_id;
  var options = {
    $pull: {
      _files : {
        _id: fileId,
      }
    }
  };

  Node.update({_id: nodeId}, options, function (error) {
    if (!error) {
      Node.findById(nodeId, function (error, node) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.deleteTaskFile',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.deleteTaskFile(node, fileId, req.user._id);
      });
    }
    generateResponse(error);
  });
});

app.get('/api/project/node/:id/raci', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var options = {
    type: 'resource',
    node: req.params.id
  };

  Raci.find(options, function (error, resources) {
    if (error) {
      return api_response(error);
    }
    options.type = 'raci_tab';

    Raci.find(options, function (error, racis) {
      api_response(error, {
        resources: resources,
        racis: racis
      });
    });
  });
});

app.put('/api/project/node/:id/ganttUpdate', function(req, res, next){
  var api_response = Api_Response(req, res, next);
  var start_date = req.body.start;
  var end_date = req.body.end;
  var node_id = req.params.id;

  function updateChildren(node_id) {
    Node.find({
      _id: node_id
    })
    .populate({
      path: "_nodes"
    })
    .exec(function (error, data) {
      if (data[0]._nodes && data[0]._nodes.length) {
        data[0]._nodes.forEach(function (subNode) {
          Node.update({
            _id: subNode._id
          }, {
            $set : {
              start_date: start_date,
              end_date: end_date
            }
          }, function (error, data) {

            if (subNode._nodes && subNode._nodes.length > 0) {
              updateChildren(subNode._id);
            }
          });
        });
      }
    });
  }

  updateChildren(node_id);
  api_response(null, {});
});
