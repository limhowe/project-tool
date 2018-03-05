(function() {

'use strict';

angular
  .module('App.controllers')
  .controller('ProjectShowCtrl', ProjectShowCtrl);

ProjectShowCtrl.$inject = ['$scope', '$rootScope', '$location', '$state', '$stateParams', '$window', '$timeout', '$modal', '$http', '$i18next', 'Project', 'Node', 'Export', 'Alert', '$compile', 'User', 'Board', 'Picker', 'Time', 'DateFormat', 'Comment', 'Risk', 'commonService'];
function ProjectShowCtrl($scope, $rootScope, $location, $state, $stateParams, $window, $timeout, $modal, $http, $i18next, Project, Node, Export, Alert, $compile, User, Board, Picker, Time, DateFormat, Comment, Risk, commonService) {
  var vm = this;

  Alert.init($scope);

  /**
   * Indicate whether left-side menu bar is visible.
   * For mobile devices (width <= 768px), hide the sidebar initially.
   * @type {Boolean}
   */
  var hasActiveSidebar = $window.innerWidth <= 768 ? true : false;

  /**
   * List of view modes available.
   * @type {Array}
   */
  vm.viewList = [];

  $scope.datepickerFormat = 'MM-dd-yyyy';

  // switch($i18next.options.lng) {
  //   case 'en':
  //     $scope.datepickerFormat = 'MM-dd-yyyy';
  //     break;
  //   case 'es':
  //     $scope.datepickerFormat = 'dd-MM-yyyy';
  //     break;
  //   default:
  //     $scope.datepickerFormat = 'MM-dd-yyyy';
  // }

  /**
   * Config whether the control to set start date on task form is opened.
   * @type {Object}
   */
  $scope.startDateControlOption = {
    opened: false
  }

  /**
   * Config whether the control to set end date on task form is opened.
   * @type {Object}
   */
  $scope.endDateControlOption = {
    opened: false
  }

  /**
   * Name of new agile board to create.
   * @type {String}
   */
  $scope.newAgileBoardName = '';

  /**
   * Config for date picker controls.
   * @type {Object}
   */
  $scope.dateOptions = {
    'year-format': "'yy'",
    'starting-day': 1,
    'show-weeks': false,
    showWeekNumbers: false
  };

  $rootScope.tree = [];
  $rootScope.currentNode = {};

  $rootScope.changeView = changeView;
  $rootScope.fetchProjectData  = fetchProjectData;
  $rootScope.updateDescription = updateDescription;
  $rootScope.updateQualityText = updateQualityText;
  $rootScope.uncompleteTask = uncompleteTask;
  $rootScope.updateComplete = updateComplete;
  $rootScope.selectNode = selectNode;
  $rootScope.hideTaskForm = hideTaskForm;
  $rootScope.updateComment = updateComment;
  $rootScope.updateTaskTitle = updateTaskTitle;
  $rootScope.showTaskForm = showTaskForm;

  vm.openMenuBar = openMenuBar;
  vm.closeMenuBar = closeMenuBar;
  vm.openEmbedVideo = openEmbedVideo;
  vm.hasSeenVideo = hasSeenVideo;
  vm.hideVideoTutorialMessage = hideVideoTutorialMessage;
  vm.changeView = changeView;

  $scope.update = update;
  $scope.recursiveNodeWalk = recursiveNodeWalk;
  $scope.createChildTask = createChildTask;
  $scope.broadcastDelete = broadcastDelete;
  $scope.refreshTree = refreshTree;
  $scope.keyPressed = keyPressed;
  $scope.assignToUser = assignToUser;
  $scope.rejectUser = rejectUser;
  $scope.openStartDate = openStartDate;
  $scope.openEndDate = openEndDate;
  $scope.nodeRiskFilter = nodeRiskFilter;
  $scope.onSelectDependency = onSelectDependency;
  $scope.addDependency = addDependency;
  $scope.deleteDependency = deleteDependency;
  $scope.addQuality = addQuality;
  $scope.completeQuality = completeQuality;
  $scope.deleteQuality = deleteQuality;
  $scope.qualityProgress = qualityProgress;
  $scope.updateDuration = updateDuration;
  $scope.getExpectedTime = getExpectedTime;
  $scope.getSumOfCost = getSumOfCost;
  $scope.sumOfSubtaskCosts = sumOfSubtaskCosts;
  $scope.sumOfChildrenDuration = sumOfChildrenDuration;
  $scope.addComment = addComment;
  $scope.removeComment = removeComment;
  $scope.upvote = upvote;
  $scope.selectTaskBoard = selectTaskBoard;
  $scope.addTaskToList = addTaskToList;
  $scope.deleteRisk = deleteRisk;
  $scope.removeRisk = removeRisk;
  $scope.newFormRiskModal = newFormRiskModal;
  $scope.showRiskModal = showRiskModal;
  $scope.addTaskToRisk = addTaskToRisk;
  $scope.updateComplete = updateComplete;
  $scope.addRaci = addRaci;
  $scope.removeRaci = removeRaci;
  $scope.updateRaciRole = updateRaciRole;
  $scope.createAgileBoard = createAgileBoard;
  $scope.getRaciList = $rootScope.getRaciList;
  $scope.getProjectTimezone = getProjectTimezone;
  $scope.showAgileBoardForm = showAgileBoardForm;
  $scope.hideAgileBoardForm = hideAgileBoardForm;
  $scope.createAgileList = createAgileList;
  $scope.toggleAgileListForm = toggleAgileListForm;
  $scope.hideAgileListForm = hideAgileListForm;
  $scope.goToTask = goToTask;

  function goToTask (task) {
    $location.search('task', task._id);
    $rootScope.selectNode(task, $rootScope.tree);
  }

  function getNext (current, root, isLastIteration) {
    var next, i, len, _ref1;

    if (!root._nodes) {
      root._nodes = []
    }

    if (isLastIteration) {
      next = root._nodes.length ? angular.copy(root._nodes[0]) : null;
    } else {
      for (i = 0, len = root._nodes.length; i < len; i++) {
        if (current._id === root._nodes[i]._id) {
          next = getNext(current, root._nodes[i], true);
          if (!next) {
            next = (i<len-1 ? angular.copy(root._nodes[i+1]) : {});
          }
          if (next) {
            next.isLast = true;
          }
          break;
        } else {
          next = getNext(current, root._nodes[i]);
          if (next && next.isNext) {
            break;
          }
          if (next && next.isLast) {
            if (!next._id) {
              next = i<len-1 ? angular.copy(root._nodes[i+1]) : null;
              if (next) {
                next.isNext = true;
              }
            }
            break;
          }
        }
      }
    }

    if (next && !next._id && !root._id) {
      next = null;
    }

    return next;
  }

  function getPrev (current, root) {
    var prev, len, i, _ref1;

    for (i = 0, len = root._nodes.length; i < len; i++) {
      if (current._id === root._nodes[i]._id) {
        prev = angular.copy(prev ? prev : (root._id ? root : null));
        if (prev) {
          prev.isLast = true;
        }
        break;
      } else {
        prev = angular.copy(root._nodes[i]);
        _ref1 = getPrev(current, root._nodes[i]);
        if (_ref1) {
          prev = _ref1._id ? _ref1 : null;
          if (_ref1.isLast) {
            break;
          }
        }
      }
    }

    return prev;
  }

  $scope.$on('risk_created', onRiskCreated);

  function onRiskCreated(evt, risk) {
    $scope.riskList.push(risk);
  }

  $rootScope.getMixedStrLength = getMixedStrLength;
  $rootScope.subStringMixedStr = subStringMixedStr;

  /**
   * substract string from  mixed string of unicode
   * @param {String} str String with unicode value
   */
  function subStringMixedStr(str,start,len) {
    // This matches all CJK ideographs.
    var cjkRegEx = /[\u3400-\u4db5\u4e00-\u9fa5\uf900-\ufa2d]/;

    // This matches all characters that "break up" words.
    var wordBreakRegEx = /\W/;

    var strLength = 0;
    var returnStr = '';
    _.each(str, function (curChar) {
      if (strLength < len-1) {
        if (cjkRegEx.test(curChar)) {
          // Character is a CJK ideograph.
          strLength = strLength + 2;
        } else if (wordBreakRegEx.test(curChar)) {
          // Character is a "word-breaking" character.
          strLength = strLength + 2;
        } else {
          strLength = strLength + 1;
        }
        returnStr = returnStr + curChar;
      }
    });

    return returnStr;
  }

  /**
   * Count length of mixed string of unicode
   * @param {String} str String with unicode value
   */
  function getMixedStrLength(str) {
    // This matches all CJK ideographs.
    var cjkRegEx = /[\u3400-\u4db5\u4e00-\u9fa5\uf900-\ufa2d]/;

    // This matches all characters that "break up" words.
    var wordBreakRegEx = /\W/;

    var strLength = 0;
    _.each(str, function (curChar) {
      if (cjkRegEx.test(curChar)) {
        // Character is a CJK ideograph.
        strLength = strLength + 2;
      } else if (wordBreakRegEx.test(curChar)) {
        // Character is a "word-breaking" character.
        strLength = strLength + 2;
      } else {
        strLength = strLength + 1;
      }
    });

    return strLength;
  }

  /**
   * Retrieve project details.
   * @param {String]} projectId
   * @param {Function} cb
   */
  function fetchProjectData(projectId, cb) {
    Project
      .get(projectId)
      .then(onProjectGetSuccess);

    function onProjectGetSuccess(project) {
      project.id = project._id;
      project.title = project.name;
      project.users = project._users;

      $rootScope.project = project;
      $scope.datepickerFormat = DateFormat.getFormat(project.dateformat).str;

      User
        .me()
        .then(function (user) {
          // Change the locale according to the user account setting.
          $i18next.options.lng = user.language || 'en';

          $rootScope.user = user;

          var isInProject = false;
		  angular.forEach(project._users, function (_user) {
            if ( _user.user && _user.user._id == user._id ) {
			  isInProject = true;
			}
          });

          if (!isInProject) {
            project._users.push({
              user: user
            });
          }

          isInProject = false;
		  angular.forEach(project._users, function (_user) {
            if ( _user.user && _user.user._id == project._user._id ) {
			  isInProject = true;
			}
          });

          if (!isInProject) {
            project._users.push({
              user: project._user
            });
          }

          Risk
            .get_risks(projectId)
            .then(function (risks) {
              User
                .getById(project._user._id)
                .then(function (owner) {
                  dealWithUsers($rootScope.project, owner);
                });

              $scope.project = $rootScope.project;
              $scope.riskList = risks;

              Node
                .getList(projectId)
                .then(function (nodes) {
                  $rootScope.tree = nodes;

                  $rootScope.$broadcast('project_fetched', {
                    user: $rootScope.user,
                    project: $rootScope.project,
                  });

                  if (cb && typeof cb == 'function') {
                    cb(project);
                  }
                });
            });
        });
    }
  }

  /**
   * Add RACI to task.
   * Called to add RACI on task form.
   */
  function addRaci(node) {
    node.$waiting_update = true;
    node.$saved = false;

    var exists = _.find(node.racis, function (raci) {
      return raci.resource === node.$raci.resource && raci.role === node.$raci.role;
    });

    if (exists) {
      node.$raci = null;
      node.waiting_update = false;
      Alert.danger('Already exists');
      return;
    }

    var payload = {
      project: $stateParams.id,
      node: node._id,
      resource: node.$raci.resource,
      role: node.$raci.role,
      type: 'raci_tab'
    };

    Project
      .addRaci(payload)
      .then(function (raci) {
        node.racis.push(raci);
        node.$raci = null;
        node.$waiting_update = false;

        node.$saved = true;
        $timeout(function () {
          node.$saved = false;
        }, 1500);
      }, function (error) {
        node.$waiting_update = true;
        node.$saved = false;
        if (error == 'Forbidden') { Alert.danger($i18next('taskForm.onlyProjectCreatorCanChangeRACI')); }
      });
  }

  function removeRaci(node, raci) {
    var projectId = $stateParams.id;
    Project.deleteRaci(projectId, raci._id)
    .then(function () {
       node.racis = _.reject(node.racis, function (_raci) {
         return _raci._id == raci._id;
       });
    }, function (error) {
      if (error == 'Forbidden') { Alert.danger($i18next('taskForm.onlyProjectCreatorCanChangeRACI')); }
    });
  }

  /**
   * Update RACI role on task form.
   * @param {Raci} raci
   * @param {String} role
   */
  function updateRaciRole(raci, role, label, color) {
    Project.updateRaci($stateParams.id, raci._id, {
      role: role
    })
    .then(function(){
      $scope.setRaciRole(label, color);
    },
    function(error){
      if (error == 'Forbidden') { Alert.danger($i18next('taskForm.onlyProjectCreatorCanChangeRACI')); }
    });
  }

  $scope.setRaciRole = function (role, color) {
    $scope.raciButton.innerHTML = $i18next('taskForm.'+role.toLowerCase()) + "<span class='caret'></span>";
    $scope.raciButton.style.backgroundColor = color;
    $scope.raciButton.className = 'btn btn-primary dropdown-toggle raciButton' + ' ' + role.toLowerCase();
  };

  function recursiveNodeWalk(d, fn) {
    fn(d);

    if (!d._nodes || !d._nodes.length) {
      return;
    }

    _.each(d._nodes, function (d) {
      fn(d);

      if (d._nodes && d._nodes.length) {
        recursiveNodeWalk(d, fn);
      };
    });
  }

  $scope.$on('collaborator_invited', function (e, data) {
    fetchProjectData($stateParams.id);
  });

  /**
   * Hide task form.
   */
  function hideTaskForm() {
    $timeout(function () {
      $location.search('task', '');
      $scope.isTaskFormVisible = false;
      $rootScope.currentNode = {};
    }, 0);
  }

  /**
   * Change project view mode.
   * @param {String} curView
   */
  function changeView(curView) {
    _.each(vm.viewList, function (view) {
      if (view.name == curView) {
        $timeout(function () {
		  //hides task form but does not change task url param because ui-sref will change the current url
          $scope.isTaskFormVisible = false;
          $rootScope.currentNode = {};

          $scope.viewType = curView;
          $rootScope.viewType = curView;
          if (view.ngClick && view.ngClick.length) {
			       eval(view.ngClick);
		      }
        }, 0);
      }
    });
  }

  /**
   * Close left-side menu bar.
   */
  function closeMenuBar() {
    $('.ui-menu-panel').animate({
      opacity: 0,
      left: -115
    }, 200, function () {
      hasActiveSidebar = false;
    });

    $('.app-panel').animate({
      paddingLeft: 25
    }, 200, function () {

    });
  }

  function closeOnClickOut(elem) {
    var $document = $(document);

    function bindEvent(e) {
      var $elem = $(elem);
      var $target = $(e.target);

      if ($(e.target).closest($elem).length) {
        return;
      }

      if ($scope.timeout) {
        clearTimeout($scope.timeout);
      }

      $scope.timeout = setTimeout(function () {
        $document.off('click', bindEvent);
      }, 50);
    }

    $document.one('click', function (e) {
      bindEvent(e);
    });
  }

  /**
   * Open/close left-side menu bar.
   */
  function openMenuBar() {
    if (hasActiveSidebar) {
      closeMenuBar();
      if ($rootScope.currentNode && $rootScope.currentNode._id) {
        hideTaskForm();
      }
    } else {
      $('.ui-menu-panel').animate({
        opacity: 1,
        left: -1
      }, 200, function () {
        hasActiveSidebar = true;
      });

      $('.app-panel').animate({
        paddingLeft: 120
      }, 200, function () {

      });

      closeOnClickOut('.ui-menu-panel');
    }
  }

  openMenuBar();

  function activateButt() {
    var loc = $location.$$path.split('/');
    _.each(vm.viewList, function (view) {
      if (view.active == loc[loc.length - 1]) {
        setTimeout(function () {
          changeView(view.name);
        }, 500);
      }
    });
  }

  activateButt();

  changeView('Simple');

  fetchProjectData($stateParams.id, function (project) {
    vm.viewList = [
      {
        name: "Simple",
        state: 'default.project.list',
        icon: "icon-list",
        ngClick: "$rootScope.fetchProjectData('" + $stateParams.id + "')",
        tooltip: 'global.list',
        embed: 'https://player.vimeo.com/video/127755428',
      },
      {
        name: "Detail View",
        state: 'default.project.detailed',
        icon: "icon-tree",
        tooltip: 'global.wbs',
        embed: 'https://player.vimeo.com/video/127765699'
      },
      {
        name: "GANTT View",
        state: 'default.project.gantt',
        icon: "icon-gantt",
        tooltip: 'global.gantt',
        embed: 'https://player.vimeo.com/video/127862082'
      },
      {
        name: "AGILE",
        state: 'default.project.agile',
        ngClick: "$rootScope.fetchProjectData('" + $stateParams.id + "')",
        icon: "icon-agile",
        tooltip: 'global.agile',
        embed: 'https://player.vimeo.com/video/127862084'
      },
      {
        name: "RACI",
        state: 'default.project.raci',
        ngClick: "$rootScope.fetchProjectData('" + $stateParams.id + "')",
        icon: "icon-raci",
        tooltip: 'global.raci',
        embed: 'https://player.vimeo.com/video/127862083'
      },
      {
        name: "Risks",
        state: 'default.project.risk',
        ngClick: "$scope.refreshTree()",
        icon: "icon-risk",
        tooltip: 'global.risks',
        embed: 'https://player.vimeo.com/video/128075912'
      },
      {
        name: "SETTINGS",
        state: 'default.project.manage',
        icon: "fa fa-cog",
        tooltip: 'global.settings',
        id: "settings-icon"
      }
    ];

    activateButt();
  });

  /**
   * Show dialog for tutorial video.
   */
  function openEmbedVideo() {
    var view = getCurrentView($rootScope.viewType);
    $("<a data-toggle='data-toggle='lightbox' data-width='800' href='" + view.embed + "'>").ekkoLightbox({
      title: view.title || view.name,
    });
  }

  function getCurrentView(name) {
    return _.find(vm.viewList, function (view) {
      return view.name == name;
    });
  }

  function refreshTree(fn) {
    Node
      .getList($stateParams.id)
      .then(function (nodes) {
        $rootScope.tree = nodes;
        Risk
          .get_risks($stateParams.id)
          .then(function (risks) {
            $scope.riskList = risks;
            if (fn && typeof(fn) == "function") {
              fn(nodes, risks);
            }
          });
      });
  }

  function keyPressed(e) {
    $scope.keyCode = e.which;
  }

  $scope.exportToSimpleCSV = function() {
    Export.simple('csv', $scope.project, $rootScope.tree);
  };

  $scope.exportToSimpleXML = function() {
    Export.simple('xml', $scope.project, $rootScope.tree);
  };

  $scope.exportToRiskCSV = function () {
    Export.simple('risk-csv', $scope.project, $scope.riskList);
  };

  $scope.searchUser = User.search;

  function isUserAssigned(task, user) {
    if (!task._assigned_users) {
      task._assigned_users = [];
    }

    return _.find(task._assigned_users, function (_user) {
      return (user.invite_email && _user.invite_email && user.invite_email == _user.invite_email) ||
        (!user.invite_email && !_user.invite_email && user.user && user.user._id == _user.user._id);
    });
  }

  function assignToUser(node, user) {
    var _user = user.user ? user.user : user;
    var user_email = _user.email ? _user.email : _user.invite_email;
    if (!node.assigned_users) {
      node.assigned_users = [];
    }

    if (isUserAssigned(node, user)) {
      return;
    }

    if (user.invite_email) {
      node.assigned_users.push({
        invite_email: user.invite_email
      });
    } else {
      node.assigned_users.push({
        user: user.user._id
      });
    };

    commonService.manageUsers(node, $scope.project.users);

    User.assign(user_email, node._id).then(function (data) {
      $timeout(function () {
        node = data;
        $rootScope.$broadcast('assigned_to_user', node, user);

        Project.addRaci({
          allowCollaborator: true,
          project: $stateParams.id,
          node: node._id,
          resource: user_email,
          role: 'responsible',
          type: 'raci_tab'
        });
      },0);
    });
  }

  function rejectUser(node, user_email) {
    user_email.email = user_email.email.replace(" (waiting for registration)", '');
    User.reject(user_email.email, node._id).then(function () {
      _.each($rootScope.currentNode.assigned_users, function (assigned_user) {
        if (matcheAssignedUserEmail(user_email.email, assigned_user)) {
          $rootScope.currentNode.assigned_users.splice(node.assigned_users.indexOf(assigned_user), 1);
          commonService.manageUsers(node, $scope.project.users);
        }
      });
    });
  }

  function matcheAssignedUserEmail(user_email, assigned_user) {
    if (!user_email || !assigned_user || !$scope.project || !$scope.project.users) {
      return false;
    }

    var user = _.find($scope.project.users, function (_user) {
      return _user.invite_email == user_email || _user.user && _user.user.email == user_email;
    });

    if (!user) {
      return false;
    }

    return (assigned_user.invite_email && assigned_user.invite_email === user_email) ||
      (user && user.user && user.user._id === assigned_user.user);
  }

  function openStartDate($event) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.startDateControlOption.opened = true;
  }

  function openEndDate($event) {
    $event.preventDefault();
    $event.stopPropagation();

    $scope.endDateControlOption.opened = true;
  }

  function getForm(node, newNode) {
    $scope.eTitle = "";
    node.showInput = true;
    $scope.formCss = {
      'margin-left': '0px'
    };
    if (newNode) {
      $scope.formCss = {
        'margin-left': '30px'
      };
    }
  }

  function createNode(node, parent_id, cb) {
    Node
      .add($scope.project._id, parent_id, node)
      .then(function (data) {
        $rootScope.currentNode = data;

        Node
          .getList($stateParams.id)
          .then(function (nodes) {
            $rootScope.tree = nodes;
            $scope.getRaciList();

            recursiveWhere($rootScope.tree, $rootScope.currentNode._id, function (node) {
              if ($scope.isFirst) {
                $scope.isFirst = false;
                getForm(node, true);
              } else {
                getForm(node, false);
              }
            });
          });
      });
  }

  $scope.delete = function (node, cb) {
    Node
      .delete(node._id)
      .then(function () {
        if (cb && typeof(cb) == 'function') {
          cb();
        } else {
          Node
            .getList($stateParams.id)
            .then(function (nodes) {
              $rootScope.tree = nodes;
            })
            .catch(Alert.danger);
        }
      });
  };

  function updateComplete(task, completed) {
    if (completed) {
      task.complete = 100;
    }
    Node.update(task._id, {
      complete: task.complete
    });
    refreshProgress(task);
    $rootScope.$broadcast('task_complete_updated', task);
  }

  $scope.cloneTask = function (task) {
    Node.clone(task._id, task._project, task._parent ? task._parent._id : undefined)
    .then(function(node) {
      $rootScope.$broadcast('task_clone_completed', task, node);
    })
  }

  $scope.completeTask = function (task) {
    if ($scope.completeUpdateTimeout) {
      $timeout.cancel($scope.completeUpdateTimeout);
    }

    if (task.complete == 100) {
      task.complete = 0;
    } else {
      task.complete = 100;
    }

    $scope.completeUpdateTimeout = $timeout(function () {
      Node.update(task._id, {
        complete: task.complete
      })
	  .then(function(){
        $rootScope.$broadcast('task_complete_updated', task);
	  });
    }, 350);
  };

  function uncompleteTask(task) {
    if ($scope.completeUpdateTimeout) {
      $timeout.cancel($scope.completeUpdateTimeout);
    }

    $scope.completeUpdateTimeout = $timeout(function () {
      task.complete = '1';
      var node = {
        complete: '1'
      };
      Node.update(task._id, node)
	  .then(function(){
        $rootScope.$broadcast('task_complete_updated', task);
	  });
    }, 350);
  }

  /**
   * Update node.
   * Called when task attributes are changed on task form.
   * @param {Node} node
   */
  function update(node) {
    if ($rootScope.viewType == 'detailView') {
      d3
        .selectAll("text#id_" + node._id)
        .text(function (d) {
          if (d.title.length > 15) {
            return d.title.substring(0, 15) + '...';
          } else {
            return d.title;
          }
        });
    }

    node.$status = null;
    node.$previous = null;

    node.$editing = false;
    node.$saved = false;
    node.$saving_process = true;

    var _raci = node._raci;
    var _nodes = node._nodes;
    var children = node.children;
    var _children = node._children;
    var parent = node.parent;

    Node
      .update(node._id, node)
      .then(function () {

        delete node.children;
        delete node._children;
        delete node._raci;
        delete node.parent;
        delete node._nodes;
        delete node._dependency;
        delete node._files;
        delete node._quality;
        delete node._shared;
        delete node._state;
        delete node.assignedUsers;
        delete node.comments;
        delete node.list;
        delete node.racis;

        node._raci = _raci;
        node._nodes = _nodes;
        node.children = children;
        node._children = _children;
        node.parent = parent;

        getExpectedTime(node);
        getSumOfCost(node);

        node.$saved = true;
        node.$saving_process = false;
        node.$waiting_update = false;

        $timeout(function () {
          node.$saved = false;
        }, 1500);
      });
  }

  function dealWithUsers(project, owner) {
    if (!owner) {
      return project;
    }
    project.collaborators = [];
    var owner_name;
    if (owner.name && (owner.name.first || owner.name.last)) {
      owner_name = owner.name.first + ( owner.name.first ? ' ' : '' ) + owner.name.last;
    } else {
      owner_name = owner.email;
    }

    project.collaborators.push({
      email: owner.email,
      name: owner_name,
      id: owner.email
    });

    if (!project || !project._users || !project._users.length) {
      return project;
    }

    _.each(project._users, function (user) {
      if (!user.user) {
        return;
      }

      var name;
      if (user.user.name && (user.user.name.first || user.user.name.last)) {
        name = user.user.name.first + (user.user.name.first ? ' ' : '') + user.user.name.last;
      } else {
        name = user.user.email;
      }

      project.collaborators.push({
        type: 'registered',
        email: user.user.email,
        name: name,
        id: user.user.email
      });
    });

    project.collaborators = _.uniq(project.collaborators , function (value) {
      return value.email;
    });

    return project;
  }

  /**
   * Select task and open task form.
   * @param {Node} node
   * @param {Board} board
   * @param {List} list
   */
  function selectNode(node, board, list) {
    var _ref1, _ref2;

    $location.search('task', node._id);
    $scope.isTaskFormVisible = true;
    $rootScope.currentNode = node;
    $rootScope.currentNode.activeForm = true;
    $rootScope.currentNode.showForm = true;

    $rootScope.nextTask = typeof (_ref1 = getNext($rootScope.currentNode, {_nodes: $rootScope.tree})) !== 'boolean' ? _ref1 : null;
    $rootScope.prevTask = (_ref2 = getPrev($rootScope.currentNode, {_nodes: $rootScope.tree}));

    commonService.manageUsers(node, $scope.project.users);

    commonService.populateRisks(node, $scope.riskList);

    Node.getRaci(node._id).then(function (data) {
      node.resources = data.resources;
      node.racis = data.racis;
    });

    Board.all($stateParams.id).then(function (boards) {
      $scope.boards = boards;

      $scope.sort.list = {};
      $scope.sort.board = {};

      var found = false;
      _.each($scope.boards, function (board) {
        _.each(board.lists, function (list) {
          _.each(list.tasks, function (_task) {
            if (found) return;
            else {
              if (_task.node == node._id) {
                $scope.sort.list = list;
                $scope.sort.board = board;
                found = true;
              }
            }
          });
        });
      });
    });

    Comment
      .all(node._id)
      .then(function (comments) {
        $scope.comments = comments;

        var user = $scope.user._id.toString();

        Comment.traverse($scope.comments, function (comment) {
          if (comment && comment._id) {
            comment.upvote = (comment.upvotes.indexOf(user) == -1) ? false : true;
          }
        });

        $('#commentText').mentionsInput({
          onDataRequest:function (mode, query, callback) {
            var data = $scope.project.collaborators;
            data = _.filter(data, function (item) {
              return item.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
            });
            callback.call(this, data);
          }
        });
      });

    refreshProgress($rootScope.currentNode);

    $('#task_form_include').animate({
            scrollTop: 0},
            'slow');
  }

  function recursiveWhere(nodes, id, fn) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node._id == id) {
        fn(node);
      } else if (node && node._nodes && node._nodes.length) {
        recursiveWhere(node._nodes, id, fn);
      }
    }
  }

  $scope.collapse = function (node) {
    node.$collapsed = true;
  };

  $scope.expand = function (node) {
    node.$collapsed = false;
  };

  $scope.nodesByTitle = function (title) {
    return Node.nodesByTitle(title, $stateParams.id);
  };

  function onSelectDependency(item, node) {
    if (!node.$dependency) {
      node.$dependency = item;
      return;
    }

    node.$dependency.title = item.title;
    node.$dependency._id = item._id;
  }

  function addDependency(node) {
    node._dependency = node._dependency || [];
    Node
      .addDependency(node._id, node.$dependency._id, node.$dependency.type)
      .then(function () {
        node._dependency.push({
          node: {
            _id: node.$dependency._id,
            title: node.$dependency.title
          },
          type: node.$dependency.type
        });
        node.$dependency = null;
      })
      .catch(function (error) {
        node.$waiting_update = true;
        node.$saved = false;
        Alert.danger(error);
      });
  }

  function deleteDependency(node, dependency) {
    node.$waiting_update = true;
    Node
      .deleteDependency(node._id, dependency.node._id, dependency.type)
      .then(function () {
        node._dependency = _.reject(node._dependency, function (_dependency) {
          return _dependency.node && _dependency.node._id == dependency.node._id && _dependency.type == dependency.type;
        });

        node.$waiting_update = false;

        node.$saved = true;
        $timeout(function () {
          node.$saved = false;
        }, 1500);
      })
      .catch(function () {
        node.$waiting_update = true;
        node.$saved = false;
      });
  }

  $scope.close = function () {
    $rootScope.modalInstance.close();
  };

  function addQuality(node) {
    if (!node.$qualityText || !node.$qualityText.length) {
      return;
    }

    var duplicate = _.find(node._quality, function (quality) {
      if (quality.text === node.$qualityText.text) {
        return true;
      }
    });

    if (duplicate) {
      return;
    }

    var payload = {
      text: node.$qualityText,
      completed: false,
    };

    Node
      .addQuality(node._id, payload)
      .then(function (data) {
        node._quality = data._quality;
        node.$qualityText = null;

        refreshProgress(node);
      });
  }

  function completeQuality(node, quality) {
    refreshProgress(node);
    Node
      .updateQuality(node._id, quality._id, quality.completed)
      .catch(function (error) {
        node._quality.completed = false;
      });
  }

  function deleteQuality(node, quality) {
    Node
      .deleteQuality(node._id, quality._id)
      .then(function () {
        node._quality = _.reject(node._quality, function (_quality) {
          return quality._id == _quality._id;
        });
        refreshProgress(node);
      });
  }

  function qualityProgress(node) {
    if (!node || !node._quality || !node._quality.length) {
      return 0;
    }

    var completed = _.reduce(node._quality, function (count, quality) {
      return count + (quality.completed ? 1 : 0);
    }, 0);

    return Math.round(completed / node._quality.length * 100);
  }

  function refreshProgress(node) {
    if (!$scope.project.settings.use_quality) {
      return;
    }

    var old_progress = node.complete;

    node.complete = qualityProgress(node);

    if (old_progress != node.complete) {
      $scope.update(node, {
        $valid: true
      });
    }
  }

  $scope.addFromDropbox = function () {
    var options = {
      success: function (files) {
        var file = files[0];
        var payload = {
          from: 'dropbox',
          bytes: file.bytes,
          link: file.link,
          name: file.name,
          added_at: new Date(),
        };

        Node
          .addFile($rootScope.currentNode._id, payload)
          .then(function (fileObj) {
            $rootScope.currentNode._files.push(fileObj);
          });
      },
      linkType: "preview"
    };

    Dropbox.choose(options);
  };

  $scope.addFromGoogle = function () {
    Picker.google($('#google'), function (files) {
      var file = files[0];
      var payload = {
        from: 'google',
        link: file.url,
        name: file.name,
        added_at: new Date()
      };

      Node
        .addFile($rootScope.currentNode._id, payload)
        .then(function (fileObj) {
          $rootScope.currentNode._files.push(fileObj);
        });
    });
  };

  $scope.addFromOneDrive = function () {
    var pickerOptions = {
      success: function(files) {
        // Handle returned file object(s)
        //alert("You picked " + files.values[0].fileName);
        var file = files[0];
        var payload = {
          from: 'onedrive',
          bytes: file.size,
          link: file.link,
          name: file.fileName,
          added_at: new Date()
        };

        Node
          .addFile($rootScope.currentNode._id, payload)
          .then(function (fileObj) {
            $rootScope.currentNode._files.push(fileObj);
          });
      },

      cancel: function() {
        // handle when the user cancels picking a file
      },

      linkType: "webViewLink", // or "downloadLink",
      multiSelect: false // or true
    };

    OneDrive.open(pickerOptions);
  };

  /**
   * Called when clicking on 'Upload' button.
   */
  $scope.uploadFile = function () {
    // http://stackoverflow.com/a/19519023
    setTimeout(function () {
      // Open the file select dialog.
      angular.element('.upload-file').click();
    }, 0);
  };

  /**
   * Called when a file is selected from the file dialog.
   */
  $scope.onSelectFile = function (element) {
    if (!element.files[0]) {
      return;
    }
    Alert.info($i18next('taskForm.uploading'));
    Node
      .uploadFile($rootScope.currentNode._id, element.files[0])
      .then(function (res) {
        $rootScope.currentNode._files.push(res);
      })
      .catch(function (error) {
        Alert.danger($i18next('taskForm.failToUpload'));
      });
  };

  $scope.deleteFile = function (file) {
    if (!confirm($i18next('taskForm.deleteFileConfirm'))) {
      return;
    }

    var files = $rootScope.currentNode._files;

    Node
      .deleteFile($rootScope.currentNode._id, file._id)
      .then(function () {
        _.each(files, function (f, i) {
          if (f._id === file._id) {
            files.splice(i, 1);
          }
        });
      });
  };

  function getTimeValueInHours(timeObj) {
    if (!timeObj) {
      return 0;
    }

    if (timeObj.type === 'minutes') {
      return timeObj.value / 60;
    } else if (timeObj.type === 'hours') {
      return timeObj.value;
    } else if (timeObj.type === 'days') {
      return timeObj.value * 24;
    } else if (timeObj.type === 'weeks') {
      return timeObj.value * 7 * 24;
    } else if (timeObj.type === 'months') {
      return timeObj.value * 31 * 24;
    }
  }

  function updateDuration(currentNode) {
    // check for validity
    var duration = getTimeValueInHours(currentNode.duration);
    currentNode.end_date = new Date(new Date(currentNode.start_date).setHours(duration));
    Node.update(currentNode._id , {
      duration: currentNode.duration,
      end_date: currentNode.end_date
    }, true);
  }

  function getExpectedTime(node) {
    if (node.optimisticTime && node.mostLikelyTime && node.pessimisticTime && node.optimisticTime.type === node.mostLikelyTime.type && node.mostLikelyTime.type === node.pessimisticTime.type) {
      node.expectedTime = {
        value: parseFloat(((node.optimisticTime.value + 4 * node.mostLikelyTime.value + node.pessimisticTime.value) / 6).toFixed(0)),
        type: node.optimisticTime.type
      };
    } else {
      node.expectedTime = {
        value: parseFloat(((getTimeValueInHours(node.optimisticTime) + 4 * getTimeValueInHours(node.mostLikelyTime) + getTimeValueInHours(node.pessimisticTime)) / 6).toFixed(0)),
        type: 'hours'
      };
    }

    return node.expectedTime;
  }

  function getSumOfCost(node) {
    if (!node) {
      return 0;
    }

    if (!node._nodes) {
      return !node.cost ? 0 : parseFloat(node.cost);
    }

    function getSumOfCostforNode(node_el) {
      if (!node_el._nodes || !node_el._nodes.length) {
        return node_el.cost;
      }

      return _.reduce(node_el._nodes, function (sum, childNode) {
        return sum + getSumOfCostforNode(childNode);
      }, node_el.cost);
    }
    var sum = getSumOfCostforNode(node);
    return !sum ? 0 : sum;
  }

  function sumOfSubtaskCosts(node) {
    if (!node._nodes) {
      return 0;
    }

    return _.reduce(node._nodes, function (total, node) {
      return total + node.cost;
    }, 0);
  }

  function sumOfChildrenDuration(node) {
    if (!node || !node._nodes) {
      return 0;
    }

    return _.reduce(node._nodes, function (total, node) {
      return total + getTimeValueInHours(node.duration);
    }, 0);
  }

  // Calendar options
  $scope.today = function() {
    $scope.dt = new Date();
    $scope.dts = new Date();
  };

  $scope.today();

  //its very general name should be different one like clearDt or something
  $scope.clear = function () {
    $scope.dt = null;
  };

  // Disable weekend selection
  $scope.disabled = function (date, mode) {
    return (mode === 'day' && (date.getDay() === 0 || date.getDay() === 6));
  };

  $scope._raci = {
    showInput: false,
    showRaciInput: false,
  };

  $scope.showRaciInput = function () {
    $scope._raci.showInput = true;
    $scope._raci.showRaciInput = true;
    $scope.resourceName = "";
  };

  $scope.cancelRaciAdd = function () {
    $timeout(function () {
      $scope._raci.showInput = false;
      $scope._raci.showRaciInput = false;
    }, 200);
  };

  $scope.stashButton = function (button) {
    $scope.raciButton = button.target;
  };

  //-===================================================================================
  // Comments
  //-===================================================================================

  /**
   * Add new comment.
   */
  function addComment(text, node, parent, comments) {
    if (!text) {
      return;
    }

    //escapeHtml
    var entityMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': '&quot;', "'": '&#39;' };
    text = String(text).replace(/[&<>"']/g, function (s) {
      return entityMap[s];
    });

    var mentionedUsers = text.match(/@\[(.*?)\]/g);
    var mu = [];
    mentionedUsers = _.uniq(mentionedUsers, function (value) {
      return value;
    });

    $('#commentText').mentionsInput('getMentions', function (data) {
      _.each(data, function (item) {
        if (item.email || item.id) {
          mu.push(item.email ? item.email : item.id);
        }
      });
    });

    var payload = {
      text: text,
      level: parent ? parent.level + 1 : 0,
      node: node._id,
      parent: parent ? parent._id : null,
      created_at: new Date(),
      mentionedUsers: mu
    };

    Comment
      .add(payload)
      .then(function (doc) {
        doc.children = [''];
        $('#commentText').html('');

        if (parent) {
          parent.show_reply = false;
          parent.children.push(doc);
        } else {
          $scope.comments = $scope.comments || [];
          $scope.comments.push(doc);
        }
      })
      .catch(Alert.danger);
  }

  $scope.show_reply = function (comment) {
    comment.show_reply = !comment.show_reply;
    Comment.traverse($scope.comments, function ($comment) {
      if (comment._id !== $comment._id) {
        $comment.show_reply = false;
      }
    });
  };

  /**
   * Remove comment.
   * @param {Comment} comment [description]
   * @param {Array} parent
   */
  function removeComment(comment, parent) {

    Comment
      .remove(comment._id)
      .then(function () {

        //if (parent.children) {
		      //parent.children = parent.children.splice( _.findIndex(parent.children, function (_comment) {
          //  return comment._id == _comment._id;
          //}), 1 );

          //parent.children = _.reject(parent.children, function (_comment) {
          //  return comment._id == _comment._id;
          //});
        //}

		    parent = parent.splice( _.findIndex(parent, function (_comment) {
          return comment._id == _comment._id;
        }), 1 );

        //parent = _.reject(parent, function (_comment) {
        //  return comment._id == _comment._id;
        //});

      })
      .catch(Alert.danger);
  }

  /**
   * Upvote comments.
   * @param {Comment} comment
   */
  function upvote(comment) {
    var payload = {
      upvote: comment.upvote ? -1 : 1
    };

    Comment
      .update(comment._id, payload)
      .then(function () {
        comment.upvote = !comment.upvote;

        if (payload.upvote === 1) {
          comment.upvotes.push($scope.user._id);
        } else {
          comment.upvotes.splice(comment.upvotes.indexOf($scope.user._id), 1);
        }

        comment.upvotes_count = comment.upvotes.length;
      })
      .catch(Alert.danger);
  }

  //-===================================================================================
  //- task form agile controllls
  //-===================================================================================

  $scope.sort = {};
  $scope.sort.board;
  $scope.sort = {};
  $scope.sort.list;


  //-===================================================================================
  //- task form assign controllls
  //-===================================================================================

  $scope.$watch($rootScope.currentNode, function () {
    $rootScope.currentNode.start_date = Date.parse($rootScope.currentNode.start_date) ? Date.parse($rootScope.currentNode.start_date) : $rootScope.currentNode.start_date;
    $rootScope.currentNode.end_date =Date.parse($rootScope.currentNode.end_date) ? Date.parse($rootScope.currentNode.end_date) : $rootScope.currentNode.end_date;

    Board
      .all($stateParams.id)
      .then(function (boards) {
        $scope.boards = boards;
        _.each($scope.boards, function (board) {
          if (board.name != $rootScope.currentNode.agile_board) {
            return;
          }

          $scope.sort.board = board;
          $scope.sort.list = _.find(board.lists, function (list) {
            return list.name == $rootScope.currentNode.agile_status;
          });
        });
      });
  });

  function recursiveWalk(d, fn) {
    if (!d.children || !d.children.length) {
      return;
    }

    _.each(d.children, function (d) {
      fn(d);
      if (d.children && d.children.length) {
        recursiveWalk(d, fn);
      };
    });
  }

  /**
   * Called when a task description is updated on task form.
   */
  function updateDescription(text) {
    text.text = text.text ? text.text : ' ';
    return Node.update($rootScope.currentNode._id, {
      notes: text.text
    })
    .then(function (data) {
      $rootScope.currentNode.notes = text.text;
    });
  };

  function updateQualityText(text) {
    text.text = text.text ? text.text : ' ';
    Node
      .updateQualityText($rootScope.currentNode._id, text._id, text.text)
      .then(function (data) {
        refreshProgress($rootScope.currentNode);
      });
  }

  /**
   * Update comment.
   * @param {Comment} comment
   */
  function updateComment(comment) {
    return Comment.update(comment._id, {
      text: comment.text
    });
  }

  /**
   * Called when a list is selected on task form.
   */
  function addTaskToList(task, list, board) {
    $timeout(function () {
      task.agile_status = list.name;
      task.agile_board = board.name;
      $scope.sort.list = list;

      Board.remove_task(task._id, list._id).then(function () {
        Board.add_to_list(task._id, list._id).then(function (data) {
          Node
            .update(task._id, {
              agile_status: list.name,
              agile_board: board.name
            })
            .then(function (data) {
              if (!list.nodes) {
                list.nodes = [];
              }

              if (!list.tasks) {
                list.tasks = [];
              }

              list.tasks.push({
                node: task
              });
              $rootScope.$broadcast('node_form_task_added', board, list);
            });
        });
      });
    }, 0);
  }

  $rootScope.$on('collaborator_invited', function (event, _data) {
    if ($scope.project) {
      $scope.project._users.push(_data);
    }
  });

  /**
   * Open form to add new agile board on task form.
   */
  function showAgileBoardForm() {
    $rootScope.isAgileBoardFormVisible = true;
  }

  /**
   * Open form to add new agile board on task form.
   */
  function hideAgileBoardForm() {
    $rootScope.isAgileBoardFormVisible = false;
  }

  /**
   * Toggle form to add new agile list on task form.
   */
  function toggleAgileListForm() {
    $scope.isAgileListFormVisible = !$scope.isAgileListFormVisible;
  }

  /**
   * Hide form to add new agile list on task form.
   */
  function hideAgileListForm() {
    $scope.isAgileListFormVisible = false;
  }

  $scope.$on('task_deleted', function () {
    $rootScope.currentNode = {};
    hideTaskForm();
  });

  /**
   * Create new board from task form.
   * @param {String} name New board name.
   */
  function createAgileBoard(name) {
    if (!name || name == '') {
      return;
    }

    Board
      .create(name, $scope.project.id)
      .then(function (board) {
        Node.update($rootScope.currentNode._id, {
          agile_board: board.name
        });

        $scope.newAgileBoardName = '';
        hideAgileBoardForm();
        $rootScope.currentNode.agile_board = board.name;
        $scope.boards.push(board);
        $scope.sort.board = board;
        $rootScope.$broadcast('node_form_board_created', board);
      })
      .catch(Alert.danger);
  }

  /**
   * Create new agile list on task form.
   * @param {Board} board
   * @param {String} name New list name.
   */
  function createAgileList(board, name) {
    if (!name || name == '') {
      return;
    }

    Board
      .create_list(name, board._id)
      .then(function (list) {
        $timeout(function () {
          $rootScope.currentNode.agile_status = list.name;
          $scope.sort.list = list;
          $scope.sort.board.lists.push(list)
          $scope.newAgileListName = '';
          addTaskToList($rootScope.currentNode, list, board)
          hideAgileListForm();
        }, 0);
      });
  }

  /**
   * Called when a board is selected on task form
   */
  function selectTaskBoard() {
    if (!$scope.sort.board) {
      Board.remove_task($rootScope.currentNode._id, $scope.sort.list._id);
    }

    $scope.sort.list = {}
    $rootScope.currentNode.agile_status = '';
    $rootScope.currentNode.agile_board = $scope.sort.board ? $scope.sort.board.name : '';
  }

  /**
   * Update task title on task form.
   * @param {Object} d
   */
  function updateTaskTitle(d) {
    if ($rootScope.currentNode && $rootScope.currentNode._id == d._id) {
      $rootScope.currentNode.title = d.text;
    }

    if (d._id == 'temp') {
      $rootScope.$broadcast('temp_task_confirmed', d);
    } else {
      Node
        .update(d._id, {
          title: d.text
        })
        .then(function () {
          $rootScope.$broadcast('task_title_edited', d);
        });
    }
  }

  /**
   * Show task form.
   * @param {Node} task
   */
  function showTaskForm(task) {
    $scope.isTaskFormVisible = true;
    selectNode(task);
  }

  function nodeRiskFilter(risk) {
    if (!$rootScope.currentNode || !$rootScope.currentNode._id || $rootScope.currentNode.risks.indexOf(risk) != -1) {
      return false;
    }
    return true;
  }

  function createChildTask(task, side) {
    if ($scope.timeout) {
      clearTimeout($scope.timeout);
    };

    $scope.timeout = setTimeout(function () {
      $rootScope.$broadcast('child_task_created', task, side);
    }, 200);
  }

  function broadcastDelete(task) {
    $rootScope.$broadcast('task_delete', task);
  }

  $scope.scrollToNewTask = function (task) {
    var el = angular.element('#' + task._id);
    if (!el.offset()) {
      return;
    }

    var elementsTop = el.offset().top;
    var documentScrollPos = window.innerHeight + window.scrollY;
    if (elementsTop > documentScrollPos) {
      window.scrollTo(0, el.offset().top - window.innerHeight + window.scrollY + 50);
    };
  };

  $rootScope.scrollToNewTask = $scope.scrollToNewTask;

  $scope.$on('agile_task_removed', function (e, task) {
    if ($scope.isTaskFormVisible) {
      hideTaskForm();
    }
  });

  $scope.$on('agile_task_added', function (e, board, list, task) {
    $scope.sort.list = list;
    $scope.sort.board = board;
  });

  $scope.$on('agile_list_changed', function (e, task, list) {
    hideTaskForm();
    task.node.agile_status = list.name;
  });

  $scope.$on('user_assigned_from_assign_modal', function (e, user_email, node) {
    assignToUser(node, user_email);
  });

  $scope.$on('user_rejected_from_assign_modal', function (e, email, node) {
    $rootScope.currentNode = node;
    rejectUser(node, {
      email: email
    });
  });

  $rootScope.editRisk = function (d) {
    var risk = d.scope.currentRisk;

    var key = Object.keys(d.data)[0];
    risk[key] = d.text;
    d.data[key] = d.text;
    var id = risk._id
    Risk.updateRisk(id, d.data);
  };

  /**
   * Delete a risk.
   * @param {Node} node
   * @param {Risk} risk
   */
  function deleteRisk(node, risk, e) {
    e.stopPropagation();
    if (!confirm($i18next('riskView.deleteRiskConfirm'))) {
      return;
    }
    Risk
      .deleteRisk(risk)
      .then(function () {
        $scope.riskList.splice($scope.riskList.indexOf(risk), 1);
        commonService.populateRisks(node, $scope.riskList);
      });
  }

  /**
   * Detach a risk from node.
   */
  function removeRisk(node, risk, e) {
    e.stopPropagation();

    Risk
      .remove_node(risk._id, node._id)
      .then(function () {
        $timeout(function () {
          node.risks.splice(node.risks.indexOf(risk), 1);
        }, 0);
      });
  }

  /**
   * Open modal dialog to edit risk details selected.
   */
  function showRiskModal(risk) {
    $scope.currentRisk = risk;
    $scope.$root.currentRisk = risk;

    var modalInstance = $modal.open({
      templateUrl: 'showRiskModal.html',
      controller: 'riskModalController',
      windowClass: 'show-risk-modal',
      size: 'lg',
      resolve: {
        risk: function () {
          return risk;
        }
      }
    });
  }

  /**
   * Open modal dialog to add new risk.
   */
  function newFormRiskModal() {
    $scope.currentRisk = undefined;

    $rootScope.modalInstance = $modal.open({
      templateUrl: 'formRiskModal.html',
      controller: 'riskModalController',
      windowClass: 'show-risk-modal',
      size: 'lg',
    });
  }

  $scope.newRiskModal = function (risk) {
    $scope.currentRisk = risk;

    $rootScope.modalInstance = $modal.open({
      templateUrl: 'newRiskModal.html',
      controller: 'riskModalController',
      windowClass: 'formRiskModal',
      size: 'lg',
    });
  };

  $scope.add_from_typeahead = function (node, risk) {
    addTaskToRisk(risk, node);
  }

  /**
   * Add task to risk.
   */
  function addTaskToRisk(risk, node) {
    if (node.risks.indexOf(risk) != -1) {
      return;
    }

    Risk.add_node(risk._id, node._id).then(function () {
      node.risks.push(risk);
      risk.node.push(node);
      risk.query = '';
    });
  }

  $scope.stopProp = function (e) {
    e.stopPropagation();
  };

  $scope.$on('risk_deleted', function (e, risk, node) {
    node.risks.splice(node.risks.indexOf(risk), 1);
  });

  /**
   * Check if the current user has seen the video tutorial on the current page.
   */
  function hasSeenVideo() {
    if (!$state.includes('default.project')) {
      return true;
    }

    if (!$scope.user) {
      return false;
    }

    if (!_.isArray($scope.user.has_seen_video)) {
      $scope.user.has_seen_video = [];
    }

    var index = _.findIndex($scope.user.has_seen_video, function (statuses) {
      return statuses.name == $state.current.name;
    });

    if (index !== -1 && $scope.user.has_seen_video[index].status) {
      return true;
    }

    return false;
  }

  /**
   * Hide the video tutorial message.
   */
  function hideVideoTutorialMessage(evt) {
    if (!_.isArray($scope.user.has_seen_video)) {
      $scope.user.has_seen_video = [];
    }

    var index = _.findIndex($scope.user.has_seen_video, function (statuses) {
      return statuses.name == $state.current.name;
    });

    if (index === -1) {
      $scope.user.has_seen_video.push({
        name: $state.current.name,
        status: true,
      });
    } else {
      $scope.user.has_seen_video[index].status = true;
    }

    // Save the dismiss state.
    User
      .update({
        has_seen_video: $scope.user.has_seen_video,
      })
      .then(function () {
        //
      })
      .catch(function (errors) {
        //
      });
  }

  /**
   * Get project time zone.
   * @return {String}
   */
  function getProjectTimezone() {
    if (!$scope.project) {
      return $i18next('taskForm.notSet');
    }

    var tz = Time.find_timezone($scope.project.timezone);
    return $i18next(tz ? tz.str : 'taskForm.notSet');
  }
}

})();
