var Api_Response = Middlewares.general.api_response;
var Project = Models.Project;
var Board = Models.Board;
var List = Models.List;
var Node = Models.Node;
var User = Models.User;
var Activity = Models.Activity;
var ObjectId = require('mongoose').Types.ObjectId;
var auth = Middlewares.secure.auth;
var socket = Helpers.socket;

app.post('/api/board', auth, createBoard);
app.put('/api/project/:project_id/board/:board_id', auth, updateBoard);
app.delete('/api/board/:board_id', auth, deleteBoard);

app.post('/api/board/:board_id/list', auth, createList);
app.put('/api/board/:board_id/list/:list_id', auth, updateList);
app.delete('/api/list/:list_id', auth, deleteList);

app.post('/api/list/:list_id/task', auth, addTaskToList);
app.delete('/api/list/:list_id/task/:task_id', auth, removeTaskFromList);

app.get('/api/project/:id/board', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  Board.find({
    project: req.params.id
  })
  .populate({ path: 'lists', options: { sort: 'position' } })
  .exec(api_response);
});

/**
 * Create new board.
 */
function createBoard(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var projectId = req.body.project;

  var board = new Board({
    name: req.body.name,
    project: projectId
  });

  board.save(function (error) {
    if (error) {
      return generateResponse(error);
    }

    var query = {
      _id: projectId
    };
    var changes = {
      $push: {
        boards: board._id
      }
    }
    var opts = {
      multi: false
    };

    Project.update(query, changes, opts).exec(function (error) {
      if (error) {
        return generateResponse(error);
      }

      var activity = new Activity({
        action: 'activityFeed.addBoard',
        project: board.project,
        user: req.user._id,
        board: board._id,
        boardName: board.name
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.createNewBoard(board, req.user._id);

      generateResponse(null, board);
    });
  });
}

app.get('/api/board/:board_id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var board_id = req.params.board_id;

  Board.findById(board_id).exec(function (error, board) {
    if (error) return api_response(error);

    List.find({ board: board_id })
    .populate('tasks.node')
    .exec(function (error, lists) {
      if (error) return api_response(error);

      board = board.toObject();
      board.lists = lists.map(function (list) { return list.toObject(); });

      api_response(null, board);
    });
  });

  function foreach_users (board, proc) {
    board.lists.forEach(function (list) {
      list.tasks.forEach(function (task) {
        if (task.node && task.node.assigned_users) {
          task.node.assigned_users.forEach(function (user) {
            proc(user);
          });
        }
      });
    });
  }
});

/**
 * Update board.
 */
function updateBoard(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var boardId = req.params.board_id;

  if (req.body.name) {
    Board
      .findById(boardId)
      .exec(function (error, board) {
        if (error) {
          return generateResponse(error);
        }

        if (!board) {
          return generateResponse('Board not found.');
        }

        board.set('name', req.body.name);

        board.save(function (error) {
          if (error) {
            return generateResponse(error);
          }

          var activity = new Activity({
            action: 'activityFeed.renameBoard',
            project: board.project,
            user: req.user._id,
            board: board._id,
            boardName: board.name
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.renameBoard(board, req.user._id);

          generateResponse(null);
        });
      });
  }

  if (req.body.start_date || req.body.end_date) {
    Board.findById(boardId).exec(function (error, board) {
      if(error) return generateResponse(error);
      if(!board) return generateResponse('board was not found');

      if (req.body.start_date){
        board.set('start_date', req.body.start_date);
      } else {
        board.set('end_date', req.body.end_date);
      }

      board.save(generateResponse);
    });
  }

  if (req.body.default) {
    Board.set_default(req.params.project_id, boardId).then(generateResponse).catch(generateResponse);
  }
}

/**
 * Delete board.
 */
function deleteBoard(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var boardId = req.params.board_id;

  Board.findById(boardId, function (error, board) {
    var projectId = board.project;
     board.remove(function (error) {
      if (error) {
        return generateResponse(error);
      }

      var activity = new Activity({
        action: 'activityFeed.deleteBoard',
        project: board.project,
        user: req.user._id,
        board: board._id,
        boardName: board.name
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.deleteBoard(boardId, projectId, req.user._id);

      generateResponse(null);
    });
  });
}

//Lists
app.get('/api/board/:board_id/lists', function (req, res, next) {
  var api_response = Api_Response(req, res, next);

  List
    .find({
      board: req.params.board_id
    })
    .populate('tasks.node')
    .populate('tasks._nodes')
    .exec(api_response);
});

/**
 * Create new list.
 */
function createList(req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  Board
    .create_list(req.body.name, req.params.board_id)
    .then(function (data) {
      var activity = new Activity({
        action: 'activityFeed.addList',
        project: data.board.project,
        user: req.user._id,
        board: data.board._id,
        boardName: data.board.name,
        list: data.list._id,
        listName: data.list.name
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.createNewList(data.board, data.list, req.user._id);

      generateResponse(null, data.list);
    })
    .catch(generateResponse);
}

/**
 * Update list.
 */
function updateList(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var listId = req.params.list_id;
  var boardId = req.params.board_id;
  var position = req.body.position;

  if (req.body.name) {
    List
      .findById(listId)
      .populate('board')
      .exec(function (error, list) {
        if (error) {
          return generateResponse(error);
        }
        if (!list) {
          return generateResponse('List not found.');
        }

        list.set('name', req.body.name);

        list.save(function (error) {
          if (error) {
            return generateResponse(error);
          }

          var activity = new Activity({
            action: 'activityFeed.updateList',
            project: list.board.project,
            user: req.user._id,
            board: list.board._id,
            boardName: list.board.name,
            list: list._id,
            listName: list.name
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.updateList(list, list.board.project, req.user._id);

          generateResponse(null);
        });
      });
  }

  if (req.body.default) {
    List
      .set_default(listId, boardId)
      .then(generateResponse)
      .catch(generateResponse);
  }

  if (position || position == 0) {
    List
      .change_position(position, listId, boardId)
      .then(generateResponse)
      .catch(generateResponse);
  }

  if (req.body.tasks) {
    var tasks = req.body.tasks;
    List
      .findByIdAndUpdate(listId, {
        tasks: tasks
      })
      .exec(function (error, list) {
        List
          .findById(listId)
          .populate('board')
          .populate('tasks.node')
          .exec(function (error, newList) {
            if (error) {
              return generateResponse(error);
            }

            if (newList.board) {
              var activity = new Activity({
                action: 'activityFeed.updateList',
                project: newList.board.project,
                user: req.user._id,
                board: newList.board._id,
                boardName: newList.board.name,
                list: newList._id,
                listName: newList.name
              });
              activity.save(function (error) {});

              // Send socket.io message.
              socket.updateList(newList, newList.board.project, req.user._id);
            }

            generateResponse(null, newList);
          });
      });
  }
}

/**
 * Delete list.
 */
function deleteList(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var listId = req.params.list_id;
  List
    .findById(listId)
    .populate('board')
    .exec(function (error, list) {
      if (error) {
        return generateResponse(error);
      }

      if (!list) {
        return generateResponse('List not find.');
      }

      var boardId = list.board._id;
      var projectId = list.board.project;

      list.remove(function (error) {
        if (error) {
          return generateResponse(error);
        }

        var activity = new Activity({
          action: 'activityFeed.deleteList',
          project: projectId,
          user: req.user._id,
          board: boardId,
          boardName: list.board.name,
          list: listId,
          listName: list.name
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.deleteList(listId, boardId, projectId, req.user._id)

        generateResponse(null);
      });
    });
}

/**
 * Add task to list.
 */
function addTaskToList(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var taskId = req.body.node;
  var listId = req.params.list_id;
  var position = req.body.position;

  Node
    .findById(taskId)
    .exec(function (error, node) {
      if (error) {
        return generateResponse(error);
      }

      List
        .add_task(taskId, listId)
        .then(function (list) {
          if (position) {
            List
              .change_task_position(position, taskId, listId)
              .then(function (newList) {
                generateResponse(null, newList);
              }).
              catch(generateResponse);
          } else {
            var activity = new Activity({
              action: 'activityFeed.addTaskToList',
              project: node._project,
              user: req.user._id,
              node: node._id,
              board: list.board,
              boardName: list.board.name,
              list: list._id,
              listName: list.name
            });
            activity.save(function (error) {});

            // Send socket.io message.
            socket.addTaskToList(node, list, req.user._id)

            generateResponse(null, list);
          }
        })
        .catch(generateResponse);
    });
}

app.put('/api/list/:list_id/task/:task_id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var position = req.body.position;

  if (position || position == 0) {
    List.change_task_position(position, req.params.task_id, req.params.list_id)
    .then(api_response).catch(api_response);
  } else {
    api_response('provide data to be updated');
  }
});

/**
 * Remove task from list.
 */
function removeTaskFromList(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var taskId = req.params.task_id;
  var listId = req.params.list_id;
  List
    .remove_task(taskId, listId)
    .then(function (list) {
      var activity = new Activity({
        action: 'activityFeed.removeTaskFromList',
        project: list.board.project,
        user: req.user._id,
        node: taskId,
        board: list.board._id,
        boardName: list.board.name,
        list: list._id,
        listName: list.name
      });
      activity.save(function (error) {});

      // Send socket.io message.
      socket.removeTaskFromList(taskId, list, req.user._id);

      generateResponse(null, list);
    })
    .catch(generateResponse);
}

app.put('/api/old_list/:old_list_id/new_list/:new_list_id', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var old_list_id = req.params.old_list_id;
  var new_list_id = req.params.new_list_id;

  var task_id = req.body.node_id;
  var tasks = req.body.tasks;

  var updated_lists = {};

  List.findById(new_list_id).exec(function (error, new_list) {
    if (error) return api_response(error);

    Node.update({ _id: task_id }, { agile_status: new_list.name })
    .exec(function (error) {
      if (error) return api_response(error);

      List.remove_task(task_id, old_list_id).then(function(old_list){
        updated_lists.old_list = old_list;

        List.change_task_position(position, task_id, new_list_id).then(function(new_list){
          List.findById(list_id)
          .populate('tasks.node')
          .exec(function(error, updated_list){
            updated_lists.new_list = updated_list;
            api_response(error, updated_lists)
          })
        })
      }).catch(api_response);
    });
  });
});

app.put('/api/change_task_position/list/:list_id/task/:task_id/position/:position', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  List.change_task_position(req.params.position, req.params.task_id, req.params.list_id).then(function (_list) {
    List.findById(list._id)
    .populate('tasks.node')
    .exec(function (error, list) {
      api_response(error, updated_list);
    });
  });
});
