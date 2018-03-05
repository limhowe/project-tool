(function() {

'use strict';

/**
 * Controller for the 'List' view mode of an individual project.
 */
angular
  .module('App.controllers')
  .controller('listviewController', ListViewController);

ListViewController.$inject = ['$scope', '$rootScope', '$location', '$stateParams', '$timeout', '$i18next', 'Project', 'Node', 'socketService', 'commonService', 'TempNode'];

function ListViewController($scope, $rootScope, $location, $stateParams, $timeout, $i18next, Project, Node, socketService, commonService, TempNode) {
  var vm = this;

  /**
   * Indicate whether to show a loading message or not.
   * @type {Boolean}
   */
  vm.showLoader = true;
  vm.isTaskVisible = _.isString( $location.search().task );

  /**
   * Indiciate whether it is in the process of adding a new task.
   * @type {Boolean}
   */
  var createNewTask = false;

  /**
   * Keep original node list.
   * @type {Array}
   */
  var treeCache = [];

  $scope.sTree = {};
  $scope.search = {
    query: '',
  };

  $scope.updateComplete = $rootScope.updateComplete;
  $rootScope.viewType = 'Simple';

  vm.changeHideCompleted = changeHideCompleted;
  $scope.hide = hide;
  $scope.deleteTask = deleteTask;
  $scope.cloneTask = cloneTask;
  $scope.initCollapse = initCollapse;
  $scope.createTempTask = createTempTask;
  $scope.confirmTempTask = confirmTempTask;
  $scope.cancelTempTask = cancelTempTask;
  $scope.filterByTitle = filterByTitle;
  $scope.filterByUser = filterByUser;
  $scope.isHappyParent = isHappyParent;
  $scope.isTaskComplete = isTaskComplete;
  $scope.$on('project_fetched', onProjectFetched);

  $scope.sTreeOptions = {
    dropped: updatePosition,
  };

  //$(document).on('keyup', onDocumentKeyUp);

  function recursiveWalk(d, fn) {
    if (!d._nodes || !d._nodes.length) {
      return;
    }

    _.each(d._nodes, function (_d) {
      fn(_d);
      recursiveWalk(_d, fn);
    });
  }

  function findNode(id, root) {
    var task;
    recursiveWalk(root, function (node) {
      if (node._id == id) {
        task = node;
      }
    });
    return task;
  }

  function enumarateTasks(root) {
    root.num = '';
    recursiveWalk(root, function (node) {
      if (node._parent) {
        if (node.num) {
          node.num = '';
        }

        var parent = findNode(node._parent._id, $scope.sTree);
        if (parent && parent.num) {
          node.num = parent.num + '.' + (parent._nodes.indexOf(node) + 1);
        } else {
          node.num = $scope.sTree._nodes.indexOf(node) + 1;
        }
      } else {
        node.num = root._nodes.indexOf(node) + 1;
      }
    });
  }

  function getTask(id) {
    var node;
    recursiveWalk($scope.sTree, function (_node) {
      if (_node._id == id) {
        node = _node;
      }
    });
    return node;
  }

  function renameTask(node) {
    setTimeout(function () {
      $("#" + node._id + " h4").trigger('dblclick');
      $rootScope.selectNode(node);
    }, 50);
  }

  function hide(scope, d) {
    var node_data = {
      state: {
        collapsed: !scope.collapsed,
        user: $scope.user,
      },
      title: d.title,
    };

    if (d._state && d._state.length) {
      _.find(d._state, function (state) {
        if (state.user != $scope.user._id) {
          return false;
        }

        node_data.state._id = state._id;
        return true;
      });
    }

    Node.update(d._id, node_data);

    scope.toggle();
  }

  function cloneTask(scope,task,clone) {
    if (task._parent && task._parent._id) {
      recursiveWalk($scope.sTree, function (_task) {
        if (_task._id == task._parent._id) {
          $timeout(function () {
            _task._nodes.push(clone);
          }, 0);
        }
      });
    } else {
       $timeout(function () {
          $scope.sTree._nodes.push(clone);
        }, 0);
    }
    $rootScope.selectNode(clone);
  }

  function deleteTask(scope, node) {
    if (!confirm($i18next('listView.deleteTaskConfirm'))) {
      return;
    }

    $timeout(function () {
      $scope.selected_task = {};
      $rootScope.currentNode = {};
      recursiveWalk($scope.sTree, function (_node) {
        _node._dependency = _.reject(_node._dependency, function (dependency) {
          return dependency.node._id == node._id;
        })
      });
    }, 0);

    $rootScope.hideTaskForm();

    scope.remove(node);

    Node
      .delete(node._id)
      .then(function () {
        enumarateTasks($scope.sTree);
      });
  }

  function createChildTask(scope, task, side, fn) {
    $timeout(function () {
      if (!task) {
        Node
          .add($scope.project.id, null, {
            title: 'new task'
          })
          .then(function (node) {
            $scope.sTree._nodes.push(node);
            enumarateTasks($scope.sTree);
            $rootScope.scrollToNewTask(node);
            renameTask(node);
            $rootScope.selectNode(node);
            if (typeof(fn) === "function") {
              fn(node);
            }
          })
          .catch(function (error) {
            vm.showLoader = false;
          });
      } else {
        if (!scope) {
          scope = angular.element("#"+task._id).scope();
        }

        var $modelValue = scope.$modelValue;

        if (scope.collapsed) {
          hide(scope, $modelValue);
        }

        $modelValue._nodes = $modelValue._nodes ? $modelValue._nodes : [];

        var parent_id = null;
        if (side != "top") {
          parent_id = $modelValue._id;
        }

        Node
          .add($scope.project.id, parent_id, {
            title: 'new task'
          })
          .then(function (node) {
            $modelValue._nodes.push(node);
            enumarateTasks($scope.sTree);
            $rootScope.scrollToNewTask(node);
            renameTask(node);
            if (typeof(fn) === "function") {
              fn(node);
            }
          })
          .catch(function (error) {
            vm.showLoader = false;
          });
      }
    }, 300);
  };

  function updatePosition(e) {
    var parent = e.dest.nodesScope.$parent.$modelValue ? e.dest.nodesScope.$parent.$modelValue : {_id : null};
    var node = e.source.nodeScope.$modelValue;
    var position = e.dest.index;

    if (parent._nodes) {
      _.each(parent._nodes, function (node, i) {
        node.position = i;
      });
    } else {
      _.each($scope.sTree._nodes, function (node, i) {
        node.position = i;
      });
    }

    node.position = position;
    node._parent = parent;

    enumarateTasks($scope.sTree);

    Node
      .updateParent(node._id, parent._id)
      .then(function (data) {
        Node.changePosition(node._id, position);
      });
  }

  function initCollapse(scope) {
    if (!scope.task || !scope.task._nodes) {
      return;
    }

    _.each(scope.task._state, function (state) {
      if (state.user == $scope.user._id && state.collapsed) {
        $timeout(function () {
          scope.toggle();
        }, 0);
      }
    });
  }

  /**
   * Called when 'Hide completed' option is changed.
   */
  function changeHideCompleted() {
    vm.showLoader = true;
    vm.isTaskVisible = _.isString( $location.search().task );

    Project
      .update($scope.project.id, {
        settings: {
          hide_completed: $scope.project.settings.hide_completed
        }
      })
      .then(onProjectUpdateSuccess);

    function onProjectUpdateSuccess() {
      vm.showLoader = false;

      Node
        .getList($stateParams.id)
        .then(onNodeGetListSuccess);

      function onNodeGetListSuccess(nodes) {
        $rootScope.tree = nodes;

        onProjectFetched();
      }
    }
  }

  function refreshTree() {
    vm.showLoader = true;
    vm.isTaskVisible = _.isString( $location.search().task );

    Node
      .getList($stateParams.id)
      .then(onNodeGetListSuccess);

      function onNodeGetListSuccess(nodes) {
        vm.showLoader = false;

        $rootScope.tree = nodes;

        if (!$rootScope.tree || !$rootScope.tree.length) {
          $rootScope.tree = [];
          $timeout(function () {
            vm.showLoader = false;
            createChildTask(null, null, null, function(node) {
            });
          }, 200);
        }

        $timeout(function () {
          vm.showLoader = false;
          if ($location.search().task) {
            $rootScope.selectNode(findNode($location.search().task, $scope.sTree));
          }
        }, 200);

        $scope.sTree = {
          _nodes: $rootScope.tree,
        };

        enumarateTasks($scope.sTree);

        recursiveWalk($scope.sTree, function (task) {
          commonService.manageUsers(task, $scope.project.users);
        });

        //treeCache = $scope.sTree._nodes;
        treeCache = JSON.parse(JSON.stringify($scope.sTree._nodes)); //deep clone
      }

  }

  function createTempTask(scope, task) {
    if (scope && scope.collapsed) {
      hide(scope, task);
    }
    createNewTask = true;
    var parent_id = task ? task._id : null;

    // save temp node in a defined model
    var tempNode = new TempNode($scope.project.id, parent_id);

    // attach temp node saved in the model to node tree
    if (!tempNode.task_id) {
      $timeout(function () {
        $scope.sTree._nodes.push(tempNode);
      }, 0);
    } else {
      recursiveWalk($scope.sTree, function (_task) {
        if (_task._id == tempNode.task_id) {
          $timeout(function () {
            if (!_task._nodes) { _task._nodes = []; }
            _task._nodes.push(tempNode);
          }, 0);
        }
      });
    }

    $timeout(function () {
      $("#" + tempNode._id + " h4").trigger('dblclick');
    }, 50);
  }

  function confirmTempTask(scope, task) {
    var title = angular.element('#' + task._id + '.lv-task-title').text();

    if (createNewTask) {
      // Add the temp node to DB

      Node.add(task._project, task.task_id, {
        title: title
      }).then(function (node) {

        if (!node._parent) {
          $timeout(function () {
            var tempIndex = $scope.sTree._nodes.indexOf(task);
            $scope.sTree._nodes[tempIndex] = node;
          }, 0);
        } else {
          recursiveWalk($scope.sTree, function (_task) {
            if (_task._id == task.task_id) {
              $timeout(function () {
                if (!_task._nodes) { _task._nodes = []; }

                var tempIndex = _task._nodes.indexOf(task);
                _task._nodes[tempIndex] = node;
              }, 0);
            }
          });
        }

        enumarateTasks($scope.sTree);

        if (createNewTask) {
          createNewTask = false;
          var parentTask = { _id: task.task_id };
          createTempTask(scope, parentTask);
        }

        treeCache = JSON.parse(JSON.stringify($scope.sTree._nodes)); //deep clone
        $rootScope.selectNode(node, null, null);
      });
    } else {
      // Update the title of existing node

      task.title = title;
      Node.update(task._id, {
        title: title
      })
      .then(function (node_updated) {
        treeCache = JSON.parse(JSON.stringify($scope.sTree._nodes)); //deep clone
        $rootScope.selectNode(task, null, null);
      });
    }
  }

  function cancelTempTask(scope, task) {
    if (!createNewTask) {
      $("#" + task._id + ".lv-task-title").text(task.title);
      return;
    } else {
      scope.remove(task);
      createNewTask = false;
    }
  }

  $scope.$on('child_task_created', function (e, task, side) {
    createTempTask(null, task);
  });

  $scope.$on('temp_task_confirmed', function (e, task) {
    confirmTempTask(null, task);
  });

  $scope.$on('task_complete_updated', onTaskCompleteUpdated);

  $scope.$on('task_delete', function (e, task) {
    $scope.deleteTask(angular.element('#' + task._id).scope(), task);
  });

  $scope.$on('task_clone_completed', function (e, task, clone) {
    $scope.cloneTask(angular.element('#' + task._id).scope(), task, clone);
  });

  $scope.$on('task_title_edited', function (e, task) {
    var _task = findNode(task._id, $scope.sTree);
    _task.title = task.text;
  });

  function onTaskCompleteUpdated(evt, task) {
    if (task.complete != 100 || !$scope.project.settings.hide_completed) {
      return;
    }

    var node = getTask(task._id);
    $timeout(function () {
      node.complete = 100;
      var parent = (task._parent && task._parent._nodes) ? task._parent._nodes : $scope.sTree._nodes;
      var value = _.isObject(parent[0]) ? {_id: task._id} : task._id;
      parent = _.without(parent, _.findWhere(parent, value));

      if (task._parent) {
        task._parent._nodes = parent;
      } else {
        $scope.sTree._nodes = parent;
      }
    }, 0);
  }

  function recursiveWalk2(d, fn) {
    if (!d || !d.length) {
      return;
    }

    _.each(d, function (_d) {
      fn(_d);
      recursiveWalk2(_d, fn);
    });
  }

  function filterByTitle(item) {
    if (!$scope.search.query || !$scope.search.query.length) {
      //$scope.sTree._nodes = treeCache;
      //$scope.sTree._nodes = JSON.parse(JSON.stringify(treeCache)); //deep clone

      refreshTree();
      return;
    }

    var res = [];
    recursiveWalk2(treeCache, function (node) {
      if (node.title.toLowerCase().indexOf($scope.search.query.toLowerCase()) != -1) {
        res.push(node);
      }
    });

    _.each(res, function (item) {
      item._nodes = null;
    });

    $scope.sTree._nodes = res;
  }

  function filterByUser(user) {
    //$scope.sTree._nodes = treeCache;
    $scope.sTree._nodes = JSON.parse(JSON.stringify(treeCache)); //deep clone

    if (!user) {
      angular.element('#filter-button').text($i18next('listView.allUsers'));
      $scope.sTree._nodes = treeCache;
      return;
    }

    var res = [];
    var filterText = false;
    if (user=='unassigned') {
      filterText = $i18next('listView.unassigned');
    }
    if (user.user && user.user.name) {
      filterText = user.user.name.first;
    }

    angular.element('#filter-button').text(filterText || user.invite_email || user.user.email);

    if (user=='unassigned') {
      $scope.filteredUser = {invite_email: 'unassigned'};
    } else {
      $scope.filteredUser = user;
    }

    var clone = {
      _nodes: $scope.sTree._nodes.slice(0)
    };

    recursiveWalk(clone, function (item) {

      if (user=='unassigned' && _.isArray(item._assigned_users) && item._assigned_users.length==0) {
        res.push(item);
      } else {
        _.each(item._assigned_users, function (assigned_user) {
          var user_email =  assigned_user.invite_email ?  assigned_user.invite_email : assigned_user.user.email;
          var filter_email = $scope.filteredUser.invite_email ? $scope.filteredUser.invite_email : $scope.filteredUser.user.email;
          if (user_email && filter_email && user_email == filter_email && res.indexOf(item) == -1) {
            res.push(item);
          }
        });
      }

    });

    _.each(res, function (item) {
      item._nodes = null;
    });

    $scope.sTree._nodes = res;
  }

  function isHappyParent(task) {
    var _isHappyParent = true;
    if ($scope.project && $scope.project.settings.hide_completed) {
        if (task._nodes && task._nodes.length) {
          _.each(task._nodes, function (child) {
            if (child.complete != 100) {
              _isHappyParent = false;
            }
          });
        }
        return _isHappyParent;
    } else if (!task._nodes || !task._nodes.length) {
      return _isHappyParent;
    }
  }

  function isTaskComplete(task) {
    return task.complete == 100;
  }

  /**
   * Called when project details is retrieved.
   * @param {Object} data
   */
  function onProjectFetched(evt, data) {
    if (data) {
      $scope.user = data.user;
      $scope.project = data.project;
    }

    if (!$rootScope.tree || !$rootScope.tree.length) {
      $rootScope.tree = [];
      $timeout(function () {
        vm.showLoader = false;
        createChildTask(null, null, null, function(node) {
        });
      }, 200);
    }

    $timeout(function () {
      vm.showLoader = false;
      if ($location.search().task) {
        $rootScope.selectNode(findNode($location.search().task, $scope.sTree));
      }
    }, 200);

    $scope.sTree = {
      _nodes: $rootScope.tree,
    };

    enumarateTasks($scope.sTree);

    recursiveWalk($scope.sTree, function (task) {
      commonService.manageUsers(task, $scope.project.users);
    });

    //treeCache = $scope.sTree._nodes;
    treeCache = JSON.parse(JSON.stringify($scope.sTree._nodes)); //deep clone

    // Establish a socket connection.
    var socket = socketService.getSocket($scope.project._id);

    // Socket.io event handlers.
    socket.on('task.create', onCreateNewTask);
    socket.on('task.update', onUpdateTask);
    socket.on('task.update.assignment', onUpdateTaskAssignment);
    socket.on('task.delete', onDeleteTask);
    socket.on('task.file.upload', onUploadTaskFile);
    socket.on('task.file.delete', onDeleteTaskFile);
    socket.on('task.quality.add', onAddQuality);
    socket.on('task.quality.update', onUpdateQuality);
    socket.on('task.quality.delete', onDeleteQuality);
    socket.on('task.dependency.add', onAddDependency);
    socket.on('task.dependency.delete', onDeleteDependency);
    socket.on('risk.add', onAddRisk);
    socket.on('risk.update', onUpdateRisk);
    socket.on('risk.attach', onAttachRisk);
    socket.on('risk.detach', onDetachRisk);
    socket.on('risk.delete', onDeleteRisk);
    socket.on('comment.add', onAddComment);
    socket.on('comment.update', onUpdateComment);
    socket.on('comment.upvote', onUpvoteComment);
    socket.on('comment.remove', onRemoveComment);
    socket.on('raci.add', onAddRaci);
    socket.on('task.position.update', onTaskPositionUpdate);
  }

  /**
   * Listen for pressing <Shift>+<Enter>.
   * Create a new child task under the current active task.
   */
  //function onDocumentKeyUp(evt) {
  //  if (evt.keyCode == 13 && evt.shiftKey) {
  //    if ($rootScope.currentNode && $rootScope.currentNode._id) {
  //      createChildTask(null, $rootScope.currentNode);
  //    } else {
  //      createChildTask();
  //    }
  //  }
  //}

  /**
   * Process Socket.io 'task.create' message.
   * @param {Node} task The task created.
   */
  function onCreateNewTask(task) {
    // No need to add a task again created by the current user.
    if (task.user == $scope.user._id) {
      return;
    }

    if (_.isUndefined(task._parent)) {
      $timeout(function () {
        $scope.sTree._nodes.push(task);
      }, 0);
    } else {
      recursiveWalk($scope.sTree, function (_task) {
        if (_task._id == task._parent._id) {
          $timeout(function () {
            _task._nodes.push(task);
          }, 0);
        }
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
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (task) {
      if (task._id == info.task._id) {
        $timeout(function () {
          task.title = info.task.title;
          task.complete = info.task.complete;
          task.notes = info.task.notes;
          task.agile_board = info.task.agile_board;
          task.agile_status = info.task.agile_status;

          task.start_date = info.task.start_date;
          task.end_date = info.task.end_date;
          task.duration = info.task.duration;
          task.optimisticTime = info.task.optimisticTime;
          task.pessimisticTime = info.task.pessimisticTime;
          task.mostLikelyTime = info.task.mostLikelyTime;
          task.cost = info.task.cost;
        }, 0);
      }
    });

    onTaskCompleteUpdated(null, info.task);

    // When the task form is opend for the given task.
    if ($rootScope.currentNode && $rootScope.currentNode._id == info.task._id) {
      // Update board and list.
      if ($scope.boards) {
        $scope.sort.board = _.find($scope.boards, function (board) {
          return board.name == info.task.agile_board;
        });

        if ($scope.sort.board) {
          $scope.sort.list = _.find($scope.sort.board.lists, function (list) {
            return list.name == info.task.agile_status;
          });
        } else {
          $scope.sort.list = undefined;
        }
      }
    }
  }

  /**
   * Process Socket.io 'task.update.assignment' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task The task updated.
   *   - {String} userId The user who updated the task.
   */
  function onUpdateTaskAssignment(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task.assigned_users = info.task.assigned_users;

          commonService.manageUsers(_task, $scope.project.users);
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task The task deleted.
   *   - {String} userId The user who deleted the task.
   */
  function onDeleteTask(info) {
    // No need to delete a task again deleted by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    if (_.isUndefined(info.task._parent)) {
      $scope.sTree._nodes = _.reject($scope.sTree._nodes, function (task) {
        return task._id == info.task._id;
      });
    } else {
      recursiveWalk($scope.sTree, function (task) {
        if (task._id == info.task._parent) {
          task._nodes = _.reject(task._nodes, function (childTask) {
            return childTask._id == info.task._id;
          });
        }
      });
    }

    if ($rootScope.currentNode && $rootScope.currentNode._id == info.task._id) {
      $rootScope.hideTaskForm();
    }

  }

  /**
   * Process Socket.io 'task.file.upload' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {Object} fileData
   *   - {String} userId
   */
  function onUploadTaskFile(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._files.push(info.fileData);
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.file.upload' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {String} fileId
   *   - {String} userId
   */
  function onDeleteTaskFile(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._files = _.reject(_task._files, function (file) {
            return file._id == info.fileId;
          });
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.quality.add' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {String} userId
   */
  function onAddQuality(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._quality = info.task._quality;
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.quality.update' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {String} userId
   */
  function onUpdateQuality(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._quality = info.task._quality;
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.quality.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {String} userId
   */
  function onDeleteQuality(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._quality = info.task._quality;
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.dependency.add' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {Node} dependency
   *   - {String} type
   *   - {String} userId
   */
  function onAddDependency(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._dependency.push({
            node: {
              _id: info.dependency._id,
              title: info.dependency.title
            },
            type: info.type
          });
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'task.dependency.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {Node} task
   *   - {String} dependencyTaskId
   *   - {String} type
   *   - {String} userId
   */
  function onDeleteDependency(info) {
    // No need to update a task again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (_task) {
      if (_task._id == info.task._id) {
        $timeout(function () {
          _task._dependency = _.reject(_task._dependency, function (_dependency) {
            return _dependency.node && _dependency.node._id == info.dependencyTaskId && _dependency.type == info.type;
          });
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'risk.add' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {String} userId
   */
  function onAddRisk(info) {
    // No need to update a risk again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    var risk = info.risk;
    risk.score = risk.probability * risk.impact;

    recursiveWalk($scope.sTree, function (task) {
      if (_.indexOf(risk.node, task._id) != -1) {
        $timeout(function () {
          task.risks.push(risk);
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'risk.update' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {String} userId
   */
  function onUpdateRisk(info) {
    // No need to update a risk again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    var task = $rootScope.currentNode;
    if (task && _.indexOf(info.risk.node, task._id) != -1) {
      _.find(task.risks, function (risk) {
        if (risk._id == info.risk._id) {
          $timeout(function () {
            risk.consequence = info.risk.consequence;
            risk.contingency = info.risk.contingency;
            risk.impact = info.risk.impact;
            risk.level = info.risk.level;
            risk.mitigation = info.risk.mitigation;
            risk.name = info.risk.name;
            risk.probability = info.risk.probability;
            risk.topic = info.risk.topic;
            risk.score = info.risk.probability * info.risk.impact;
          }, 0);

          return true;
        }
        return false;
      });
    }
  }

  /**
   * Process Socket.io 'risk.attach' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {Stirng} taskId
   *   - {String} userId
   */
  function onAttachRisk(info) {
    // No need to update a risk again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    var risk = _.find($scope.riskList, function (_risk) {
      return _risk._id == info.risk._id;
    });

    if (_.isUndefined(risk)) {
      return;
    }

    recursiveWalk($scope.sTree, function (task) {
      if (task._id == info.taskId) {
        $timeout(function () {
          task.risks.push(risk);
          risk.node.push(task);
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'risk.detach' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {String} taskId
   *   - {String} userId
   */
  function onDetachRisk(info) {
    // No need to update a risk again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    recursiveWalk($scope.sTree, function (task) {
      if (task._id == info.taskId) {
        $timeout(function () {
          task.risks = _.reject(task.risks, function (risk) {
            return risk._id == info.risk._id;
          });
        }, 0);
      }
    });
  }

  /**
   * Process Socket.io 'risk.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {String} riskId
   *   - {String} userId
   */
  function onDeleteRisk(info) {
    // No need to update a risk again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    if ($rootScope.currentNode) {
      recursiveWalk($scope.sTree, function (task) {
        if (task._id == $rootScope.currentNode._id) {
          $scope.riskList = _.reject($scope.riskList, function (risk) {
            return risk._id == info.riskId;
          });

          commonService.populateRisks(task, $scope.riskList);
        }
      });
    }
  }

  /**
   * Process Socket.io 'comment.add' message.
   * @param {Object} info The message with the following keys:
   *   - {Comment} comment
   *   - {String} userId
   */
  function onAddComment(info) {
    // No need to update a comment again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    // No need to update the comment if the users are on different tasks.
    if ($rootScope.currentNode && info.taskId != $rootScope.currentNode._id) {
      return;
    }

    if (info.comment.parent) {
      _.find($scope.comments, function (parentComment) {
        if (parentComment._id == info.comment.parent) {
          $timeout(function () {
            parentComment.show_reply = false;
            parentComment.children.push(info.comment);
          }, 0);
          return true;
        }
        return false;
      });
    } else {
      $scope.comments = $scope.comments || [];
      $scope.comments.push(info.comment);
    }
  }

    /**
     * Process Socket.io 'comment.update' message.
     * @param {Object} info The message with the following keys:
     *   - {Comment} comment
     *   - {String} userId
     */
    function onUpdateComment(info) {
      // No need to update a comment again updated by the current user.
      if (info.userId == $scope.user._id) {
        return;
      }

      // No need to update the comment if the users are on different tasks.
      if ($rootScope.currentNode && info.taskId != $rootScope.currentNode._id) {
        return;
      }

      if (info.comment.parent) {
        _.find($scope.comments, function (parentComment) {
          if (parentComment._id == info.comment.parent) {
            _.find(parentComment.children, function(childComment) {
              if (childComment._id == info.comment._id) {
                $timeout(function () { childComment.text = info.comment.text; }, 0);
                return true;
              }
              return false;
            });
            return true;
          }
          return false;
        });
      } else {
        $scope.comments = $scope.comments || [];
        _.find($scope.comments, function(comment) {
          if (comment._id == info.comment._id) {
            $timeout(function () { comment.text = info.comment.text; }, 0);
            return true;
          }
          return false;
        });
      }
    }

  /**
   * Process Socket.io 'comment.upvote' message.
   * @param {Object} info The message with the following keys:
   *   - {Comment} comment
   *   - {Boolean} isUpvote
   *   - {String} userId
   */
  function onUpvoteComment(info) {
    // No need to update a comment again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find($scope.comments, function (_comment) {
      if (_comment._id == info.comment._id) {
        $timeout(function () {
          _comment.upvote = !_comment.upvote;
          _comment.upvotes = info.comment.upvotes;
          _comment.upvotes_count = _comment.upvotes.length;
        }, 0);

        return true;
      }
      return false;
    });
  }

  /**
   * Process Socket.io 'comment.remove' message.
   * @param {Object} info The message with the following keys:
   *   - {String} commentId
   *   - {String} userId
   */
  function onRemoveComment(info) {
    // No need to update a comment again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

	var index = _.findIndex($scope.comments, function(comment) {
      return comment._id == info.commentId;
	});
    if (index > -1) {
	  $scope.comments.splice(index, 1);
	}

    //$timeout(function () {
    //  $scope.comments = _.reject($scope.comments, function (comment) {
    //    return comment._id == info.commentId;
    //  });
    //}, 0);
  }

  /**
   * Process Socket.io 'raci.add' message.
   * @param {Object} info The message with the following keys:
   *   - {Raci} raci
   *   - {String} userId
   */
  function onAddRaci(info) {
    // No need to update a raci again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    if (info.raci.node) {
      recursiveWalk($scope.sTree, function (task) {
        if (task._id == info.raci.node) {
          $timeout(function () {
            if (_.isUndefined(task.racis)) {
              task.racis = [];
            }

            var found = _.find(task.racis, function (raci) {
              return info.raci._id == raci._id;
            });

            if (!found) { task.racis.push(info.raci); }
          }, 0);
        }
      });
    }

  }

  /**
   * Process Socket.io 'task.position.update' message.
   * @param {Object} info The message with the following keys:
   *   - {String} nodeId
   *   - {Int} position
   *   - {String} userId
   */
  function onTaskPositionUpdate(info) {
    // No need to update a raci again updated by the current user.
    if (info.userId == $scope.user._id) {
      return;
    }

    Node
      .getList($stateParams.id)
      .then(onNodeGetListSuccess);

    function onNodeGetListSuccess(nodes) {
      $rootScope.tree = nodes;

      // if (!$rootScope.tree || !$rootScope.tree.length) {
      //   $rootScope.tree = [];
      //   $timeout(function () {
      //     vm.showLoader = false;
      //     createChildTask(null, null, null, function(node) {
      //     });
      //   }, 200);
      // }

      // if ($location.search().task) {
      //   $timeout(function () {
      //     vm.showLoader = false;
      //     $rootScope.selectNode(findNode($location.search().task, $scope.sTree));
      //   }, 200);
      // }

      $scope.sTree = {
        _nodes: nodes,
      };

      enumarateTasks($scope.sTree);

      recursiveWalk($scope.sTree, function (task) {
        commonService.manageUsers(task, $scope.project.users);
      });

      //treeCache = $scope.sTree._nodes;
      treeCache = JSON.parse(JSON.stringify($scope.sTree._nodes)); //deep clone

    }

  }

}

})();
