var _ = require('lodash');

module.exports = {
  onConnection: onConnection,
  createNewTask: createNewTask,
  updateTask: updateTask,
  updateTaskAssignment: updateTaskAssignment,
  deleteTask: deleteTask,
  uploadTaskFile: uploadTaskFile,
  deleteTaskFile: deleteTaskFile,
  addQuality: addQuality,
  updateQuality: updateQuality,
  deleteQuality: deleteQuality,
  addDependency: addDependency,
  deleteDependency: deleteDependency,
  addRisk: addRisk,
  updateRisk: updateRisk,
  attachRisk: attachRisk,
  detachRisk: detachRisk,
  addFileToRisk: addFileToRisk,
  deleteFileFromRisk: deleteFileFromRisk,
  deleteRisk: deleteRisk,
  addComment: addComment,
  updateComment: updateComment,
  upvoteComment: upvoteComment,
  removeComment: removeComment,
  addRaci: addRaci,
  createNewBoard: createNewBoard,
  renameBoard: renameBoard,
  deleteBoard: deleteBoard,
  createNewList: createNewList,
  updateList: updateList,
  deleteList: deleteList,
  addTaskToList: addTaskToList,
  removeTaskFromList: removeTaskFromList,

  removeResource: removeResource,
  updateRaciRole: updateRaciRole,
  updateNodePosition: updateNodePosition,
};

/**
 * Called when a new socket connection is established.
 * @param {Socket} socket
 */
function onConnection(socket) {
  // Initialize a global variable to keep active socket connections.
  if (_.isUndefined(global.socketConnections)) {
    global.socketConnections = [];
  }

  socketConnections.push({
    socket: socket,
  });

  socket.emit('connected');

  socket.on('socket.info', onSocketInfo);

  socket.on('disconnect', function () {
    socketConnections = _.reject(socketConnections, function (connection) {
      return connection.socket.id == socket.id;
    });
  });
}

/**
 * Called when a client sends the info of socket connection.
 * @param {Object} info
 */
function onSocketInfo(info) {
  _.find(socketConnections, function (connection) {
    if (connection.socket.id != info.socketId) {
      return false;
    }

    // Check if the current user is authorized to access the given project.
    Models.Project
      .find({
        _id: info.projectId,
        '_users.user': connection.socket.request.user._id
      })
      .exec(function (error, project) {
        if (project) {
          // Join a room for the specific project.
          connection.socket.join(info.projectId);
        }
      });

    return true;
  });
}

/**
 * Send message of creating new tasks.
 * @param {Node} task The new task created.
 */
function createNewTask(task) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.create', task);
}

/**
 * Send message of updating tasks.
 * @param {Node} task The task updated.
 * @param {String} userId The user who updated the task.
 */
function updateTask(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.update', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of updating assigned user list of tasks.
 * @param {Node} task The task updated.
 * @param {String} userId The user who updated the task.
 */
function updateTaskAssignment(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.update.assignment', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of deleting tasks.
 * @param {Node} task The task deleted.
 * @param {String} userId The user who deleted the task.
 */
function deleteTask(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.delete', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of uploading files to tasks.
 * @param {Node} task
 * @param {Object} fileData
 * @param {String} userId The user who uploaded the file.
 */
function uploadTaskFile(task, fileData, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.file.upload', {
    task: task,
    fileData: fileData,
    userId: userId
  });
}

/**
 * Send message of deleting task files.
 * @param {Node} task
 * @param {String} fileId
 * @param {String} userId The user who uploaded the file.
 */
function deleteTaskFile(task, fileId, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.file.delete', {
    task: task,
    fileId: fileId,
    userId: userId
  });
}

/**
 * Send message of adding a quality to task.
 * @param {Node} task
 * @param {String} userId
 */
function addQuality(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.quality.add', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of updating qualities of task.
 * @param {Node} task
 * @param {String} userId
 */
function updateQuality(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.quality.update', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of deleting a quality from task.
 * @param {Node} task
 * @param {String} userId
 */
function deleteQuality(task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.quality.delete', {
    task: task,
    userId: userId,
  });
}

/**
 * Send message of adding a dependency to task.
 * @param {Node} task
 * @param {Node} dependency
 * @param {String} type
 * @param {String} userId
 */
function addDependency(task, dependency, type, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.dependency.add', {
    task: task,
    dependency: dependency,
    type: type,
    userId: userId,
  });
}

/**
 * Send message of deleting a dependency from task.
 * @param {Node} task
 * @param {String} dependencyTaskId
 * @param {String} type
 * @param {String} userId
 */
function deleteDependency(task, dependencyTaskId, type, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('task.dependency.delete', {
    task: task,
    dependencyTaskId: dependencyTaskId,
    type: type,
    userId: userId,
  });
}

/**
 * Send message of adding a new risk.
 * @param {Risk} risk
 * @param {String} userId
 */
function addRisk(risk, userId) {
  // Send messages to connections joined for the specific project.
  io.to(risk.project).emit('risk.add', {
    risk: risk,
    userId: userId,
  });
}

/**
 * Send message of updating risk.
 * @param {Risk} risk
 * @param {String} userId
 */
function updateRisk(risk, userId) {
  // Send messages to connections joined for the specific project.
  io.to(risk.project).emit('risk.update', {
    risk: risk,
    userId: userId,
  });
}

/**
 * Send message of attaching risk to task.
 * @param {Risk} risk
 * @param {String} taskId
 * @param {String} userId
 */
function attachRisk(risk, taskId, userId) {
  // Send messages to connections joined for the specific project.
  io.to(risk.project).emit('risk.attach', {
    risk: risk,
    taskId: taskId,
    userId: userId,
  });
}

/**
 * Send message of detaching a risk from task.
 * @param {Risk} risk
 * @param {String} taskId
 * @param {String} userId
 */
function detachRisk(risk, taskId, userId) {
  // Send messages to connections joined for the specific project.
  io.to(risk.project).emit('risk.detach', {
    risk: risk,
    taskId: taskId,
    userId: userId,
  });
}

/**
 * Send message of adding file to risk.
 * @param {Risk} risk
 * @param {Object} fileData
 * @param {Strign} userId
 */
function addFileToRisk(risk, fileData, userId) {
  io.to(risk.project).emit('risk.add.file', {
    risk: risk,
    fileData: fileData,
    userId: userId,
  });
}

/**
 * Send message of removing file from risk.
 * @param {Risk} risk
 * @param {String} fileId
 * @param {Strign} userId
 */
function deleteFileFromRisk(risk, fileId, userId) {
  io.to(risk.project).emit('risk.delete.file', {
    risk: risk,
    fileId: fileId,
    userId: userId,
  });
}

/**
 * Send message of deleting a risk.
 * @param {String} riskId
 * @param {String} projectId
 * @param {String} userId
 */
function deleteRisk(riskId, projectId, userId) {
  // Send messages to connections joined for the specific project.
  io.to(projectId).emit('risk.delete', {
    riskId: riskId,
    userId: userId,
  });
}

/**
 * Send message of adding new comment.
 * @param {Comment} comment
 * @param {Node} task
 * @param {String} userId
 */
function addComment(comment, task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('comment.add', {
    taskId: task._id,
    comment: comment,
    userId: userId,
  });
}

/**
 * Send message of updating new comment.
 * @param {Comment} comment
 * @param {Node} task
 * @param {String} userId
 */
function updateComment(comment, task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('comment.update', {
    taskId: task._id,
    comment: comment,
    userId: userId,
  });
}

/**
 * Send message of upvoting comment.
 * @param {Comment} comment
 * @param {Boolean} isUpvote true for upvote, false for cancel.
 * @param {Node} task
 * @param {String} userId
 */
function upvoteComment(comment, isUpvote, task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('comment.upvote', {
    comment: comment,
    isUpvote: isUpvote,
    userId: userId,
  });
}

/**
 * Send message of removing comment.
 * @param {String} commentId
 * @param {Node} task
 * @param {String} userId
 */
function removeComment(commentId, task, userId) {
  // Send messages to connections joined for the specific project.
  io.to(task._project).emit('comment.remove', {
    commentId: commentId,
    userId: userId,
  });
}

/**
 * Send message of adding new raci.
 * @param {Raci} raci
 * @param {String} userId
 */
function addRaci(raci, userId) {
  // Send messages to connections joined for the specific project.
  io.to(raci.project).emit('raci.add', {
    raci: raci,
    userId: userId,
  });
}

/**
 * Send message of creating new board.
 * @param {Board} board
 * @param {String} userId
 */
function createNewBoard(board, userId) {
  io.to(board.project).emit('board.create', {
    board: board,
    userId: userId,
  });
}

/**
 * Send message of renaming board.
 * @param {Board} board
 * @param {String} userId
 */
function renameBoard(board, userId) {
  io.to(board.project).emit('board.rename', {
    board: board,
    userId: userId,
  });
}

/**
 * Send message of deleting board.
 * @param {String} boardId
 * @param {String} projectId
 * @param {String} userId
 */
function deleteBoard(boardId, projectId, userId) {
  io.to(projectId).emit('board.delete', {
    boardId: boardId,
    userId: userId,
  });
}

/**
 * Send message of creating new list.
 * @param {Board} board
 * @param {List} list
 * @param {String} userId
 */
function createNewList(board, list, userId) {
  io.to(board.project).emit('list.create', {
    list: list,
    userId: userId,
  });
}

/**
 * Send message of renaming list.
 * @param {List} list
 * @param {String} projectId
 * @param {String} userId
 */
function updateList(list, projectId, userId) {
  io.to(projectId).emit('list.update', {
    list: list,
    userId: userId,
  });
}

/**
 * Send message of deleting list.
 * @param {String} listId
 * @param {String} boardId
 * @param {String} projectId
 * @param {String} userId
 */
function deleteList(listId, boardId, projectId, userId) {
  io.to(projectId).emit('list.delete', {
    listId: listId,
    boardId: boardId,
    userId: userId,
  });
}

/**
 * Send message of adding task to list.
 * @param {Node} task
 * @param {List} list
 * @param {String} userId
 */
function addTaskToList(task, list, userId) {
  io.to(task._project).emit('list.add.task', {
    task: task,
    list: list,
    userId: userId,
  });
}

/**
 * Send message of removing task from list.
 * @param {String} taskId
 * @param {List} list
 * @param {String} userId
 */
function removeTaskFromList(taskId, list, userId) {
  io.to(list.board.project).emit('list.remove.task', {
    taskId: taskId,
    list: list,
    userId: userId,
  });
}

/**
 * Send message of removing resource from RACI.
 * @param {String} projectId
 * @param {String} resourceId
 * @param {String} userId
 */
function removeResource(projectId, resourceId, userId) {
  io.to(projectId).emit('raci.remove.resource', {
    projectId: projectId,
    resourceId: resourceId,
    userId: userId,
  });
}

/**
 * Send message of updating RACI role.
 * @param {String} projectId
 * @param {String} raciId
 * @param {String} userId
 */
function updateRaciRole(projectId, raciId, userId) {
  io.to(projectId).emit('raci.update.role', {
    projectId: projectId,
    raciId: raciId,
    userId: userId,
  });
}

/**
 * Send message of updating node position.
 * @param {String} projectId
 * @param {String} nodeId
 * @param {Int} position
 * @param {String} userId
 */
function updateNodePosition(projectId, nodeId, position, userId) {
  io.to(projectId).emit('task.position.update', {
    nodeId: nodeId,
    position: position,
    userId: userId,
  });
}
