(function() {

'use strict';

/**
 * Controller for the 'Agile' view mode of an individual project.
 */
angular
  .module('App.controllers')
  .controller('AgileController', AgileController);

AgileController.$inject = ['$scope', '$rootScope', '$location', '$state', '$timeout', '$document', '$i18next', 'Node', 'Board', 'Alert', 'commonService', 'socketService', '$q'];

function AgileController($scope, $rootScope, $location, $state, $timeout, $document, $i18next, Node, Board, Alert, commonService, socketService, $q) {
  var vm = this;

  /**
   * Indicate whether to show a loading message or not.
   * @type {Boolean}
   */
  vm.showLoader = true;

  /**
   * List of agile boards.
   * An array of Board objects.
   * @type {Array}
   */
  vm.boardList = [];

  /**
   * List of tasks.
   * An array of Node objects.
   * @type {Array}
   */
  vm.taskList = [];

  /**
   * List of task IDs to import.
   * @type {Array}
   */
  var tasksToImport = [];

  /**
   * List of tasks to move between lists.
   * An array of Node objects.
   * @type {Array}
   */
  var tasksToMove = [];

  /**
   * Indicate if it is in the process of adding new list.
   * @type {Boolean}
   */
  var isAddingList = false;

  /**
   * Indicate if it is in the process of importing tasks.
   * @type {Boolean}
   */
  var isImportingTasks = false;

  $rootScope.renameList = renameList;

  vm.setBoard = setBoard;
  vm.boardCreate = boardCreate;
  vm.removeBoard = removeBoard;
  vm.renameBoard = renameBoard;
  vm.showBoardTitleForm = showBoardTitleForm;
  vm.hideBoardTitleForm = hideBoardTitleForm;
  vm.showBoardEditForm = showBoardEditForm;
  vm.hideBoardEditForm = hideBoardEditForm;
  vm.ejectTask = ejectTask;
  vm.createList = createList;
  vm.removeList = removeList;
  vm.showListForm = showListForm;
  vm.hideListForm = hideListForm;
  vm.ejectTasks = ejectTasks;
  vm.markAll = markAll;
  vm.unmarkAll = unmarkAll;
  vm.prepareToAdd = prepareToAdd;
  vm.addUserTasks = addUserTasks;
  vm.showPanel = showPanel;
  vm.closePanel = closePanel;
  vm.addTasks = addTasks;
  vm.createTask = createTask;
  vm.deleteTask = deleteTask;
  vm.selectNode = selectNode;
  vm.dndRemove = dndRemove;
  vm.moved = moved;
  vm.dndDrop = dndDrop;
  vm.isTaskInList = isTaskInList;
  vm.isNotCompleted = isNotCompleted;

  $scope.$on('project_fetched', onProjectFetched);
  $scope.$on('node_form_board_created', onBoardCreated);
  $scope.$on('node_form_task_added', onTaskAddedToBoard);
  $scope.$on('child_task_created', onChildTaskCreated);
  $scope.$on('task_title_edited', onTaskTitleEdited);
  $scope.$on('task_delete', onTaskDeleted);
  $scope.$on('risk_deleted', onRiskDeleted);

  /**
   * Called when a project details is retrieved.
   */
  function onProjectFetched(evt, data) {
    var split = $state.current.name.split('.');
    if ('agile' != split[split.length - 1]) {
      return;
    }

    $scope.user = data.user;
    $scope.project = data.project;

    // Retrieve list of boards.
    Board
      .all($scope.project._id)
      .then(function (boards) {
        if (!boards || !boards.length) {
          vm.showLoader = false;
          vm.boardList = [];
          return;
        }

        vm.boardList = boards;

        // Retrieve non-hierarchical list of tasks.
        fetchTasks(function () {
          vm.showLoader = false;
        });

        // Open the previous active board or the first one from project.
        setBoard($location.search().board ? $location.search().board : vm.boardList[0]._id);
      });

    // Establish a socket connection.
    var socket = socketService.getSocket($scope.project._id);

    // Socket.io event handlers.
    socket.on('board.create', onCreateNewBoard);
    socket.on('board.rename', onRenameBoard);
    socket.on('board.delete', onDeleteBoard);
    socket.on('list.create', onCreateNewList);
    socket.on('list.update', onUpdateList);
    socket.on('list.delete', onDeleteList);
    socket.on('list.add.task', onAddTaskToList);
    socket.on('list.remove.task', onRemoveTaskFromList);
    socket.on('task.update', onUpdateTask);
  }

  /**
   * Process Socket.io 'board.create' message.
   * @param {Object} info The message with the following keys:
   *   - {Board} board The board created.
   *   - {String} userId The user who created the board.
   */
  function onCreateNewBoard(info) {
    // No need to process a board again created by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () {
      vm.boardList.push(info.board);
    }, 0);
  }

  /**
   * Process Socket.io 'board.rename' message.
   * @param {Object} info The message with the following keys:
   *   - {Board} board The board updated.
   *   - {String} userId The user who updated the board.
   */
  function onRenameBoard(info) {
    // No need to update a board again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.boardList, function (board) {
      if (board._id == info.board._id) {
        $timeout(function () {
          board.name = info.board.name;
        }, 0);
        return true;
      }
      return false;
    });
  }

  /**
   * Process Socket.io 'board.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {String} boardId The board ID deleted.
   *   - {String} userId The user who deleted the board.
   */
  function onDeleteBoard(info) {
    // No need to delete a board again deleted by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () {
      vm.boardList = _.reject(vm.boardList, function (board) {
        return board._id == info.boardId;
      });
    }, 0);
  }

  /**
   * Process Socket.io 'list.create' message.
   * @param {Object} info The message with the following keys:
   *   - {List} list
   *   - {String} userId The user who created the list.
   */
  function onCreateNewList(info) {
    // No need to process a list again created by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.boardList, function (board) {
      if (board._id == info.list.board) {
        $timeout(function () {
          board.lists.push(info.list);
        }, 0);
        return true;
      }
      return false;
    });

    if ($scope.board && $scope.board._id == info.list.board) {
      $timeout(function () {
        $scope.board.lists.push(info.list);
      }, 0);
    }
  }

  /**
   * Process Socket.io 'list.update' message.
   * @param {Object} info The message with the following keys:
   *   - {List} list
   *   - {String} userId The user who updated the list.
   */
  function onUpdateList(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.boardList, function (board) {
      if (board._id == info.list.board._id) {
        _.find(board.lists, function (list) {
          if (list._id == info.list._id) {
            $timeout(function () {
              list.name = info.list.name;
              list.tasks = info.list.tasks;
            }, 0);
            return true;
          }
          return false;
        });
        return true;
      }
      return false;
    });

    if ($scope.board && $scope.board._id == info.list.board._id) {
      _.find($scope.board.lists, function (list) {
        if (list._id == info.list._id) {
          $timeout(function () {
            list.name = info.list.name;
            list.tasks = info.list.tasks;
          }, 0);
          return true;
        }
        return false;
      });
    }
  }

  /**
   * Process Socket.io 'list.rename' message.
   * @param {Object} info The message with the following keys:
   *   - {String} listId
   *   - {String} boardId
   *   - {String} userId The user who updated the list.
   */
  function onDeleteList(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.boardList, function (board) {
      if (board._id == info.boardId) {
        $timeout(function () {
          board.lists = _.reject(board.lists, function (list) {
            return list._id === info.listId;
          });
        }, 0);
        return true;
      }
      return false;
    });

    if ($scope.board && $scope.board._id == info.boardId) {
      $timeout(function () {
        $scope.board.lists = _.reject($scope.board.lists, function (list) {
          return list._id === info.listId;
        });
      }, 0);
    }
  }

  /**
   * Process Socket.io 'list.add.task' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {List} list
   *   - {String} userId The user who updated the list.
   */
  function onAddTaskToList(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    if ($scope.board && $scope.board._id == info.list.board) {
      _.find($scope.board.lists, function (list) {
        if (list._id == info.list._id) {
          $timeout(function () {
            list.tasks.unshift({
              node: info.task,
              position: 0,
            });
          }, 0);
          return true;
        }
        return false;
      });
    }
  }

  /**
   * Process Socket.io 'list.remove.task' message.
   * @param {Object} info The message with the following keys:
   *   - {String} taskId
   *   - {List} list
   *   - {String} userId The user who updated the list.
   */
  function onRemoveTaskFromList(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    if ($scope.board && $scope.board._id == info.list.board._id) {
      _.find($scope.board.lists, function (list) {
        if (list._id == info.list._id) {
          $timeout(function () {
            list.tasks = _.reject(list.tasks, function (task) {
              return task.node._id == info.taskId;
            });
          }, 0);
          return true;
        }
        return false;
      });
    }
  }

  /**
   * Process Socket.io 'task.update' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task The task updated.
   *   - {String} userId The user who updated the task.
   */
  function onUpdateTask(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    if ($rootScope.currentNode && $rootScope.currentNode._id == info.task._id) {
      $timeout(function () {
        $rootScope.currentNode.title = info.task.title;
      }, 0);
    }

    _.each($scope.board.lists, function (list) {
      _.find(list.tasks, function (task) {
        if (task.node._id == info.task._id) {
          $timeout(function () {
            task.node.title = info.task.title;
          }, 0);
          return true;
        }
        return false;
      });
    });

    var task = getTask(info.task._id);
    if (task) {
      task.title = info.task.title;
    }
  }

  /**
   * Retrieve tasks of current project.
   * @param {Function} callback Optional callback.
   */
  function fetchTasks(callback) {
    Node
      .getList($scope.project._id)
      .then(function (nodes) {
        tasksToImport = [];

        // Get the non-hierarchical list of tasks.
        vm.taskList = [];
        flattenNodes(nodes);

        _.each(vm.taskList, function (task) {
          commonService.manageUsers(task, $scope.project.users);
        });

        if (callback) {
          callback();
        }
      });

    function flattenNodes(nodes) {
      _.each(nodes, function (node) {
        vm.taskList.push(node);
        if (node._nodes && node._nodes.length) {
          flattenNodes(node._nodes);
        }
      });
    }
  }

  /**
   * Open agile board.
   * @param {String} boardId
   */
  function setBoard(boardId) {
    //if ($rootScope.currentNode._id) {
    //  $rootScope.hideTaskForm();
    //}

    // TODO: Do we need to retrieve the board list again?
    Board
      .all($scope.project._id)
      .then(function (boards) {
        if (!boards || !boards.length) {
          return;
        }

        _.each(boards, function (board) {
          if (boardId != board._id) {
            return;
          }

          // TODO: Do we need to reset it again?
          vm.boardList = boards;

          // TODO: Do we need to retrieve full board details again?
          Board
            .get(boardId)
            .then(function (board) {
              $scope.board = board;

              // Update the URL.
              $location.search('board', boardId);

              _.each($scope.board.lists, function (list) {
                list.tasks = _.filter(list.tasks, function (task) {
                  return task.node && task.node._id;
                });

                _.each(list.tasks, function (task) {
                  commonService.manageUsers(task.node, $scope.project.users);
                });
              });

              $timeout(function () {
                $scope.board.active = true;
                angular.element('#board_' + board._id).scope().board.active = true;
              }, 100);

              vm.showLoader = false;
              initSortables();
            });
        });
      });
  }

  /**
   * Initialize sortable widgets for agile boards.
   */
  function initSortables() {
    $scope.board.width = $scope.board.lists.length * 400;
    setTimeout(function () {
      $('div[data-board=' + $scope.board._id + ']').sortable({
        handle: '.handler',
        update: function(event, ui) {
          var $item = $(ui.item);
          Board.update_list($item.attr('id'), $scope.board._id, {
            position: $item.index()
          }).then(function(){
            $('div[data-board=' + $scope.board._id + '] .sortable').each(function(index, element){
              _.find($scope.board.lists, function (list) {
                if (list._id == $(element).attr('id')) {
                    list.position = index;
                  return true;
                }
                return false;
              });
            });

          });
        }
      })
    }, 0);

    $timeout(function () {
      if ($location.search().task) {
        var activeTask = getTask($location.search().task);
        if (activeTask) {
          selectNode(activeTask, getTaskList(activeTask), $scope.board);
        }
      }
    }, 1200);
  }

  /**
   * Create a new board.
   */
  function boardCreate() {
    Board
      .create(vm.newBoardName || 'new board', $scope.project.id)
      .then(function (board) {
        vm.isBoardTitleFormVisible = false;
        vm.newBoardName = '';
        vm.boardList.push(board);
        setBoard(board._id);
        board.active = true;
      })
      .catch(Alert.danger);
  }

  /**
   * Remove board.
   * @param {Board} board
   */
  function removeBoard(board) {
    // Clear tasks from lists.
    var promises = [];

    _.each(board.lists, function (list) {
      promises.push(ejectTasks(list, board));
    });

    $q.all(promises).then(function (rQs) {
      Board
      .remove(board._id)
      .then(function () {
        vm.boardList = _.reject(vm.boardList, function (_board) {
          return _board._id === board._id;
        });

        if (vm.boardList[0] && vm.boardList[0]._id) {
          // Select the first board of project if available.
          setBoard(vm.boardList[0]._id);
        } else {
          $scope.board = false;
        }
      })
      .catch(Alert.danger);
    });
  }

  /**
   * Rename board.
   * @param {Board} board
   */
  function renameBoard(board) {
    Board
      .update($scope.project._id, board._id, {
        name: board.name
      })
      .then(function () {
        setBoard(board._id);
        hideBoardEditForm();
      });
  }

  /**
   * Show form to enter new board title.
   */
  function showBoardTitleForm() {
    vm.isBoardTitleFormVisible = true;
  }

  /**
   * Hide form to enter new board title.
   */
  function hideBoardTitleForm() {
    vm.isBoardTitleFormVisible = false;
  }

  /**
   * Show form to rename board title.
   */
  function showBoardEditForm() {
    vm.isBoardEditFormVisible = true;
  }

  /**
   * Hide form to rename board title.
   */
  function hideBoardEditForm() {
    vm.isBoardEditFormVisible = false;
  }

  /**
   * Remove task from list.
   * @param {List} list
   * @param {Board} board
   * @param {Node} task
   */
  function ejectTask(list, board, task) {
    Board
      .remove_task(task.node._id, list._id)
      .then(function () {
        setBoard($scope.board._id);
        fetchTasks();
      });
  }

  /**
   * Create new list.
   * @param {Board} board
   */
  function createList(board) {
    if (!vm.taskList || !vm.taskList.length) {
      $timeout(function () {
        fetchTasks();
      }, 0);
    }

    isAddingList = true;
    Board
      .create_list(vm.newListName, board._id)
      .then(function (list) {
        vm.newListName = '';
        isAddingList = false;
        board.lists.push(list);
        hideListForm();
        setBoard(board._id);
      });
  }

  /**
   * Rename list.
   * @param {Object} data
   */
  function renameList(data) {
    Board.update_list(data.data.list_id, data.data.board_id, {
      name: data.text
    });
  }

  /**
   * Remove list from board.
   * @param {List} list
   * @param {Board} board
   */
  function removeList(list, board) {
    // Clear tasks from list.
    ejectTasks(list, board);

    Board
      .remove_list(list._id)
      .then(function () {
        board.lists = _.reject(board.lists, function (_board) {
          return _board._id === list._id;
        });
      });
  }

  /**
   * Show form to enter new list name.
   */
  function showListForm() {
    vm.isListFormVisible = true;
  }

  /**
   * Hide form to enter new list name.
   */
  function hideListForm() {
    if (!isAddingList) {
      vm.isListFormVisible = false;
    }
  }

  /**
   * Clear tasks from list.
   * @param {List} list
   * @param {Board} board
   */
  function ejectTasks(list, board) {

    var deffered = $q.defer();

    Board
      .update_list(list._id, board._id, {
        tasks: []
      })
      .then(function () {
        $timeout(function () {
          list.tasks = [];
          setBoard($scope.board._id);
          fetchTasks();
        }, 0);
        deffered.resolve('done');
      }).catch(function(err) {
        deffered.reject(err);
      });

    return deffered.promise;
  }

  /**
   * Select all tasks.
   */
  function markAll(list) {
    $('.agile-import-task.' + list._id).each(function () {
      stageTask($(this).attr('id'), list);
    });
    list.markedAll = true;
  }

  /**
   * Un-select all tasks.
   */
  function unmarkAll(list) {
    list.markedAll = false;
    $('.agile-import-task.' + list._id).each(function () {
      unstageTask($(this).attr('id'), list);
    });
  }

  /**
   * Select/un-select task in import box.
   * @param {String} id Task ID.
   * @param {List} list
   */
  function prepareToAdd(id, list) {
    if ($('#' + id).hasClass('active')) {
      unstageTask(id, list);
    } else {
      stageTask(id, list);
    }
  }

  /**
   * Retrieve user email.
   * @param {User} user
   */
  function getUserEmail(user) {
    var _user = user.user ? user.user : user;
    return _user.email ? _user.email : _user.invite_email;
  }

  /**
   * Select tasks to import by user.
   * @param {User} user
   * @param {List} list
   * @param {Board} board
   */
  function addUserTasks(user, list, board) {
    var email = getUserEmail(user);
    var stagedTasks = [];
    _.each(vm.taskList, function (_task) {
      if (!_task._assigned_users) {
        return;
      }

      _.each(_task._assigned_users, function (_user) {
        if (getUserEmail(_user) == email && isTaskInList(_task)) {
          stagedTasks.push(_task._id);
        }
      });
    });

    tasksToImport = stagedTasks;
    addTasks(list, board);
  }

  /**
   * Select and highlight task to import.
   * @param {String} taskId
   * @param {List} list
   */
  function stageTask(taskId, list) {
    $('#' + taskId + '.' + list._id).addClass('active');
    tasksToImport.push(taskId);
  }

  /**
   * Un-select task from import list.
   * @param {String} taskId
   * @param {List} list
   */
  function unstageTask(taskId, list) {
    list.markedAll = false;
    $('#' + taskId + '.' + list._id).removeClass('active');
    tasksToImport.splice(tasksToImport.indexOf(taskId), 1);
  }

  /**
   * Show panel to import tasks.
   * @param {List} list
   */
  function showPanel(list) {
    var $panel = $('#panel_' + list._id);

    if (!list.hasPanelOpened) {
      list.hasPanelOpened = true;

      $panel
        .css({
          display: 'inline'
        })
        .addClass('animated fadeIn');

      $panel.one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function () {
        $document.on('click', function (e) {
          if (!$(e.target).closest($panel).length) {
            list.hasPanelOpened = true;
            showPanel(list);
          }
        });
      });
    } else {
      $document.off('click');

      $panel
        .addClass('animated fadeOut')
        .removeClass('animated fadeOut')
        .hide();

      list.hasPanelOpened = false;
    }
  }

  /**
   * Close import task panel.
   * @param {List} list
   */
  function closePanel(list) {
    $('#panel_' + list._id)
      .addClass('animated fadeOut')
      .removeClass('animated fadeOut')
      .hide();

    list.hasPanelOpened = false;
  }

  /**
   * Import tasks selected.
   * @param {List} list
   * @param {Board} board
   */
  function addTasks(list, board) {
    if (isImportingTasks) {
      return;
    }

    isImportingTasks = true;

    if (!list.tasks) {
      list.tasks = [];
    }

    var nodes = tasksToImport;
    _.each(tasksToImport, function (stagedTask) {
      var isInList = _.find(list.tasks, function (existingTask) {
        return existingTask._id == stagedTask;
      });

      if (!isInList) {
        list.tasks.push({
          node: getTask(stagedTask),
          position: list.tasks.length ? list.tasks.length + 1 : 0
        });
      }
    });

    var newTasks = [];
    _.each(list.tasks, function (task, index) {
      task.position = index;
      newTasks.push({
        node: task.node._id,
        position: task.position
      });
    });

    _.each(list.tasks, function (task) {
      _.each(nodes, function (node) {
        if (node != task.node) {
          return;
        }

        var board = _.find(vm.boardList, function (_board) {
          return _board._id == list.board;
        });

        Node.update(task.node, {
          agile_status: list.name,
          agile_board: board.name
        });
      });
    });

    Board
      .update_list(list._id, board._id, {
        tasks: newTasks
      })
      .then(function () {
        showPanel(list);
        isImportingTasks = false;
        tasksToImport = [];
        setBoard(board._id);
      });
  }

  /**
   * Retrieve task by ID.
   * @param {String} id Task ID.
   * @return {Node|undefined}
   */
  function getTask(id) {
    return _.find(vm.taskList, function (task) {
      return task._id == id;
    });
  }

  /**
   * Create a new task.
   * @param {List} list Add a new task to the 'list'.
   * @param {Node} parent If set, create a new task as a sub-task of the 'parent'.
   */
  function createTask(list, parent) {
    Node
      .add($scope.project.id, parent ? parent._id : null, {
        title: 'new task',
        position: 0
      })
      .then(function (node) {
        //vm.taskList.push(node);

        Board
          .add_to_list(node._id, list._id)
          .then(function () {
            selectNode(node, list);

            list.tasks.unshift({
              node: node,
              position: 0,
            });
          });
      });
  }

  /**
   * Delete task.
   * @param {List} list
   * @param {Board} board
   * @param {Node} task
   */
  function deleteTask(list, board, task) {
    Node
      .delete(task.node._id)
      .then(function () {
        ejectTask(list, board, task);
      });
  }

  /**
   * Select task and open task form.
   * @param {Node} node
   * @param {List} list
   * @param {Board} board
   */
  function selectNode(node, list, board) {
    $scope.sort.board = board;
    $scope.sort.list = list;
    $rootScope.selectNode(node, board);
    $location.search('task', node._id);
  }

  /**
   * Get list to which task belongs to.
   * @param {Node} task
   * @return {List|undefined}
   */
  function getTaskList(task) {
    return _.find($scope.board.lists, function (list) {
      var hasTask = _.find(list.tasks, function (_task) {
        return _task._id == task._id;
      });

      if (hasTask) {
        return true;
      }
      return false;
    });
  }

  /**
   * Filter to hide tasks already added to the agile list.
   * @param {Node} task
   */
  function isTaskInList(task) {
    var result = true;
    _.each(vm.boardList, function (board) {
      _.each(board.lists, function (list) {
        var found = _.find(list.tasks, function (_task) {
          return task._id == _task.node;
        });
        if (found) {
          result = false;
        }
      });
    });
    return result;
  }

  /**
   * Filter to show incomplete tasks only.
   * @param {Node} task
   */
  function isNotCompleted(task) {
    return !$scope.project.settings.hide_completed || task.complete != 100;
  }

  /**
   * Called when new board is created on task form.
   * @param {Object} evt
   * @param {Board} board [description]
   */
  function onBoardCreated(evt, board) {
    $timeout(function () {
      vm.boardList.push(board);
    }, 0);
    initSortables();
  }

  /**
   * Called when task is added to agile board on task form.
   * @param {Board} board
   */
  function onTaskAddedToBoard(evt, board) {
    setBoard(board._id);
  }

  /**
   * Called when child task is created on task form.
   * @param {Node} task
   * @param {String} side
   */
  function onChildTaskCreated(evt, task, side) {
    createTask($scope.sort.list, side == 'bottom' ? task : undefined);
  }

  /**
   * Called when task title is updated.
   * @param {Object} data
   */
  function onTaskTitleEdited(evt, data) {
    if ($rootScope.currentNode._id) {
      $rootScope.currentNode.title = data.text;
    }

    _.each($scope.board.lists, function (list) {
      _.each(list.tasks, function (task) {
        if (task.node._id == data._id) {
          task.node.title = data.text;
        }
      });
    });

    var _task = getTask(data._id);
    if (_task) { _task.title = data.text; }
  }

  /**
   * Called when task is deleted.
   * @param {Node} task
   */
  function onTaskDeleted(evt, task) {
    if (!confirm($i18next('agileView.deleteTaskConfirm'))) {
      return;
    }

    $rootScope.hideTaskForm();

    if (!$scope.board || !$scope.board.lists || !$scope.board.lists.length) {
      return;
    }

    _.each($scope.board.lists, function (list) {
      if (!list.tasks || !list.tasks.length) {
        return;
      }

      _.each(list.tasks, function (_task) {
        if (task._id == _task.node._id) {
          deleteTask(getTaskList(_task), $scope.sort.list.board, _task);
        }
      });
    });
  }

  /**
   * Called when risk is deleted.
   * @param {Risk} risk
   * @param {Node} node
   */
  function onRiskDeleted(evt, risk, node) {
    node.risks.splice(node.risks.indexOf(risk), 1);
  }

  /**
   * Called when dragging starts to move task between lists.
   * @param {List} list
   */
  function dndRemove(list) {
    tasksToMove = list;
  }

  /**
   * Called when dragging ends to move task between lists.
   * @param {Node} task
   * @param {List} list
   */
  function moved(task, list) {
    tasksToMove.tasks.splice(list.tasks.indexOf(task), 1);
    saveList(tasksToMove, $scope.board);
  }

  /**
   * Called when task is dropped to list.
   * @param {List} list
   * @param {Object} item
   */
  function dndDrop(list, item) {
    $('#' + item.node._id).hide();
    saveList(list, $scope.board);
    return item;
  }

  /**
   * Persistent-save tasks on lists.
   * @param {List} list
   * @param {Board} board
   */
  function saveList(list, board) {
    $timeout(function () {
      var tasks = [];
      if (list.tasks) {
        _.each(list.tasks, function (_task, index) {
          tasks.push({
            node: _task.node._id,
            position: index
          });
        });
      }
      Board.update_list(list._id, board._id, {
        tasks: tasks
      });
    }, 0);
  }
}

})();
