'use strict';

angular.module('App.controllers')
.controller('raciController', ['$scope', '$rootScope', '$stateParams', '$i18next', 'Project', 'Node', 'Export', '$timeout', 'socketService', 'Alert',
  function ($scope, $rootScope, $stateParams, $i18next, Project, Node, Export, $timeout, socketService, Alert) {

  $scope.showLoader = true;

  function getNodeList() {
    var list = [];

    _.each($rootScope.tree, function (node) {
      list = list.concat(get_raci(node));
    });

    function get_raci(node) {
      var _list = [node];

      if (node._nodes && node._nodes.length) {
        _.each(node._nodes, function (_node) {
          _list = _list.concat(get_raci(_node));
        });
      }

      return _list;
    };

    return list;
  }

  //RACI part

  $scope.addRaci = function (node) {
    var exists = false;
    node.$waiting_update = true;
    node.$saved = false;

    _.each(node.racis, function (raci, i) {
      if (raci.resource === node.$raci.resource && raci.role === node.$raci.role) {
        exists = true;
      }
    });

    if (exists) {
      node.$raci = null;
      node.waiting_update = false;
      Alert.danger($i18next('raciView.alreadyExists'));
      return;
    }

    var payload = {
      project: $stateParams.id,
      node: node._id,
      resource: node.$raci.resource,
      role: node.$raci.role,
      type: 'raci_tab'
    };

    Project.addRaci(payload)
    .then(function (new_raci) {
      node.racis.push(new_raci);
      node.$raci = null;
      node.$waiting_update = false;

      node.$saved = true;
      $timeout(function (){
        node.$saved = false;
      }, 1500);
    }, function (error) {
      node.$waiting_update = true;
      node.$saved = false;
      if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
    });
  };

  $scope.deleteRaci = function (node, raci) {
    node.$waiting_update = true;

    Project.deleteRaci($stateParams.id, raci._id)
    .then(function () {
      var target = node.resources;
      node.$waiting_update = false;

      if (raci.type == 'raci_tab') {
        target = node.racis;
      }

      _.each(target, function (val, i) {
        if (val._id == raci._id) {
          target.splice(i, 1);
        }
      });

      node.$saved = true;
      $timeout(function (){
        node.$saved = false;
      }, 1500);
    }, function (error) {
      if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
    });

  };

  $scope.addResource = function (node) {
    if (!node || !node.$resource) return;

    var resource = node.$resource;
    var exists = false;

    _.each(node.resources, function (raci, i) {
      if (raci.resource == resource) {
        return exists = true;
      }
    });

    if (exists) {
      node.$resource = null;
      Alert.danger($i18next('raciView.resourceAlreadyExists'));
      return;
    }

    node.$waiting_update = true;

    var payload = {
      project: $stateParams.id,
      node: node._id,
      resource: resource,
      type: 'resource'
    };

    Project.addRaci(payload)
    .then(function (new_resource) {
      node.resources.push(new_resource);
      node.$resource = null;
      node.$waiting_update = false;

      node.$saved = true;
      $timeout(function (){
        node.$saved = false;
      }, 1500);
    }, function (error) {
      if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
    });

  };

  $scope.deleteResource = function (node, resource) {
    if (!confirm($i18next('raciView.deleteResourceConfirm'))) {
      return;
    }

    Project
      .deleteResource($stateParams.id, resource)
      .then(function () {
        $scope.getRaciList();
        node.$waiting_update = false;

        node.$saved = true;
        $timeout(function () {
          node.$saved = false;
        }, 1500);
      }, function (error) {
        if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
      });

  };

  $scope.getRaciList = function (callback) {
    Project.getRaciList($stateParams.id).then(function (list) {
      var resources = _.keys(_.groupBy(list, 'resource')).reverse();
      if ($scope.user.name) {
        $scope.userResource = $scope.user.name.first + ' ' + $scope.user.name.last;
      } else {
        $scope.userResource = $scope.user.email;
      }

      if (resources.indexOf($scope.user.email) != -1) {
        var u = resources.splice( resources.indexOf($scope.user.email), 1)
        resources.unshift( u[0] );
      }
      $scope.showLoader = false;
      var tasks = getNodeList();
      list = {
        racis: list,
        tasks: tasks,
        resources: resources
      };

      list.task_count = _.keys(list.tasks).length;
      $scope.raciList = list;
      $scope.contactsLength = ( (list.resources.length + 1) * 206 ) - 10;
      $scope.raciWidth = 200 * $scope.raciList.resources.length + 230 + 170;

	  if (_.isFunction(callback)) { callback(); }
    })
    .catch(function (error) {

    });
  };

  $scope.findRaci = function (resource, task) {
    var found = _.find($scope.raciList.racis, function (raci) {
      if (!raci.node) {
        return false;
      }
      return raci.node._id === task._id && resource === raci.resource;
    });
    return found || '';
  };

  $scope.setRaciRole = function(role, color){
    $scope.raciButton.innerHTML = $i18next('raciView.'+role.toLowerCase()) + "<span class='caret'></span>";
    $scope.raciButton.style.backgroundColor = color;
    $scope.raciButton.className = 'btn btn-primary dropdown-toggle raciButton' + ' ' + role.toLowerCase();
  };

  $scope.updateRaciRole = function (raci, task, resource, new_role, label, color) {
    var payload = { role: new_role };

    if (raci) {
      Project.updateRaci($stateParams.id, raci._id, payload)
        .then(function () {
          $scope.setRaciRole(label, color);
        }, function (error) {
          if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
        });
    } else {
      payload = {
        project: $stateParams.id,
        node: task._id,
        resource: resource,
        role: new_role,
        type: 'raci_tab'
      };

      Project
        .addRaci(payload)
        .then(function () {
          $scope.setRaciRole(label, color);

          $scope.raciList.racis.push(payload);

          _.each($scope.raciList.racis, function ($raci, i) {
            if ($raci.resource === resource && $raci.type === 'raci_tab' && !$raci.node && !$raci.role) {
              Project.deleteRaci($stateParams.id, $raci._id);
              $scope.raciList.racis.splice(i, 1);
            }
          });
        }, function (error) {
          if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
        });

    }
  };

  $scope.addPerson = function (person) {
    var resources = $scope.raciList.resourceKeys;

    if (resources && resources.indexOf(person) !== -1) {
      return;
    }

    if (!person || !person.length) {
      return;
    }

    var payload = {
      project: $stateParams.id,
      resource: person,
      type: 'raci_tab'
    };

    Project.addRaci(payload)
    .then(function (new_raci) {
      $scope.getRaciList();
      $scope.resourceName = '';
      if ($rootScope.currentNode && $rootScope.currentNode.racis) {
        $rootScope.currentNode.racis.push(new_raci);
      };
    }, function (error) {
      if (error == 'Forbidden') { Alert.danger($i18next('raciView.onlyProjectCreatorCanChangeRACI')); }
    });
  };

  $scope.filterByUser = function(user) {
    if (!user) {
      angular.element('#filter-button').text('All Users');
    } else {
      angular.element('#filter-button').text( user.user.name.first || user.user.email || user.invite_email + ' (waiting for registration)' );
    }
  };

  $scope.exportToRaciCSV = function () {

    $scope.getRaciList(
 function() {
    var racis = _.map($scope.raciList.racis, function (raci) {
      var node = null;
      if (raci.node) {
        node = {
          _id: raci.node._id,
        };
      }

      return {
        node: node,
        resource: raci.resource,
        role: raci.role
      };
    });

    var tasks = _.map($scope.raciList.tasks, function (task) {
      return {
        _id: task._id,
        title: task.title
      };
    });

    var list = {
      racis: racis,
      tasks: tasks,
      resources: $scope.raciList.resources,
    }

    Export.simple('raci', $scope.project, list);
 });

  };

  $scope.$on('project_fetched', function () {
    $scope.user = $rootScope.user;
    Node
      .getList($stateParams.id)
      .then(function (_nodes) {
        $rootScope.tree = _nodes;
        $scope.getRaciList();
      });
  });

  // Establish a socket connection.
  var socket = socketService.getSocket($stateParams.id); //project._id

  // Socket.io event handlers.
  socket.on('raci.add', function(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () { $scope.getRaciList(); }, 0);
  });

  socket.on('raci.remove.resource', function(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () { $scope.getRaciList(); }, 0);
  });

  socket.on('raci.update.role', function(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () { $scope.getRaciList(); }, 0);
  });

}]);
