(function() {

'use strict';

/**
 * Controller for the 'Risk' view mode of an individual project.
 */
angular
  .module('App.controllers')
  .controller('RiskViewController', RiskViewController);

RiskViewController.$inject = ['$scope', '$rootScope', '$modal', '$timeout', '$stateParams', '$i18next', 'Picker', 'Alert', 'Node', 'Risk', 'commonService', 'socketService'];

function RiskViewController($scope, $rootScope, $modal, $timeout, $stateParams, $i18next, Picker, Alert, Node, Risk, commonService, socketService) {
  var vm = this;

  Alert.init($scope);

  /**
   * Whether to show/hide a loading icon.
   * @type {Boolean}
   */
  vm.showLoader = true;

  /**
   * List of risks.
   * @type {Array}
   */
  vm.riskList = [];

  vm.searchTask = searchTask;
  vm.showTaskSearch = showTaskSearch;
  vm.removeRisk = removeRisk;
  vm.toggleButtons = toggleButtons;
  vm.addFromDropbox = addFromDropbox;
  vm.addFromGoogle = addFromGoogle;
  vm.addFromOneDrive = addFromOneDrive;
  vm.uploadFile = uploadFile;
  vm.deleteFile = deleteFile;
  vm.deleteRisk = deleteRisk;
  vm.sortTable = sortTable;

  $scope.onSelectFile = onSelectFile;
  $scope.$on('risk_created', onRiskCreated);

  /**
   * Keep the list of project tasks.
   * @type {Array}
   */
  var nodeList = [];

  initialize();

  /**
   * Initialize risk view.
   */
  function initialize() {
    var projectId = $stateParams.id;

    Node
      .getList(projectId)
      .then(function (nodes) {
        nodeList = nodes;
        getRiskList();
      });

    // Establish a socket connection.
    var socket = socketService.getSocket(projectId);

    // Socket.io event handlers.
    socket.on('risk.add', onAddRisk);
    socket.on('risk.update', onUpdateRisk);
    socket.on('risk.attach', onAttachRisk);
    socket.on('risk.detach', onDetachRisk);
    socket.on('risk.add.file', onAddFile);
    socket.on('risk.delete.file', onDeleteFile);
    socket.on('risk.delete', onDeleteRisk);
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

    onRiskCreated();
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

    _.find(vm.riskList, function (risk) {
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

  /**
   * Process Socket.io 'risk.attach' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {Stirng} taskId
   *   - {String} userId
   */
  function onAttachRisk(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    var task = _.find(nodeList, function (_task) {
      return _task._id == info.taskId;
    });

    if (!task) {
      return;
    }

    _.find(vm.riskList, function (risk) {
      if (risk._id == info.risk._id) {
        $timeout(function () {
          risk.node.push(task);
        }, 0);
        return true;
      }
      return false;
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
    if (info.userId == $scope.user._id) {
      return;
    }

    var task = _.find(nodeList, function (_task) {
      return _task._id == info.taskId;
    });

    if (!task) {
      return;
    }

    $timeout(function () {
      _.find(vm.riskList, function (risk) {
        if (risk._id == info.risk._id) {
          risk.node = _.reject(risk.node, function (task) {
            return task._id == info.taskId;
          });
          return true;
        }
        return false;
      });

      commonService.populateRisks(task, vm.riskList);
    });
  }

  /**
   * Process Socket.io 'risk.add.file' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {Object} fileData
   *   - {String} userId
   */
  function onAddFile(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.riskList, function (risk) {
      if (risk._id == info.risk._id) {
        $timeout(function () {
          risk._files.push(info.fileData);
        }, 0);
        return true;
      }
      return false;
    });
  }

  /**
   * Process Socket.io 'risk.delete.file' message.
   * @param {Object} info The message with the following keys:
   *   - {Risk} risk
   *   - {String} fileId
   *   - {String} userId
   */
  function onDeleteFile(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    _.find(vm.riskList, function (risk) {
      if (risk._id == info.risk._id) {
        $timeout(function () {
          risk._files = _.reject(risk._files, function (file) {
            return file._id == info.fileId;
          });
        }, 0);
        return true;
      }
      return false;
    });
  }

  /**
   * Process Socket.io 'risk.delete' message.
   * @param {Object} info The message with the following keys:
   *   - {String} riskId
   *   - {String} userId
   */
  function onDeleteRisk(info) {
    if (info.userId == $scope.user._id) {
      return;
    }

    $timeout(function () {
      vm.riskList = _.reject(vm.riskList, function (risk) {
        return risk._id == info.riskId;
      });
    }, 0);
  }

  /**
   * Retrieve list of risks.
   */
  function getRiskList() {
    Risk
      .get_risks($stateParams.id)
      .then(function (risks) {
        _.each(nodeList, function (node) {
          _.each(risks, function (risk) {
            risk.score = risk.probability * risk.impact;
            risk.task = {
              title: node.title
            };
          });
        });
        vm.riskList = risks;
        vm.showLoader = false;
      });
  }

  /**
   * Delete risk.
   * @param {Node} node
   * @param {Risk} risk
   */
  function deleteRisk(node, risk) {
    if (!confirm($i18next('riskView.deleteRiskConfirm'))) {
      return;
    }
    Risk
      .deleteRisk(risk)
      .then(function () {
        vm.riskList.splice(vm.riskList.indexOf(risk), 1);
        commonService.populateRisks(node, vm.riskList);
        node.risks.splice(node.risks.indexOf(risk), 1);
      });
  }

  /**
   * Typeahead engine for tasks to associate to risks.
   * @param  {Risk} risk
   */
  function searchTask(risk) {
    if (!risk.query || !risk.query.length) {
      return;
    }

    var res = [];
    recursiveNodeWalk({_nodes: nodeList}, function (node) {
      if (node.title && node.title.toLowerCase().indexOf(risk.query.toLowerCase()) != -1 && risk.node.indexOf(node) == -1) {
        res.push(node);
      }
    });
    return res;

    function recursiveNodeWalk(d, fn) {
      if (!d._nodes || !d._nodes.length) {
        return;
      }

      _.each(d._nodes, function (d) {
        fn(d)
        if (d._nodes && d._nodes.length) {
          recursiveNodeWalk(d, fn);
        };
      });
    }
  }

  /**
   * Remove task from risk.
   * @param {Node} node
   * @param {Risk} risk
   * @param {Event} e
   */
  function removeRisk(node, risk, e) {
    e.stopPropagation();
    Risk
      .remove_node(risk._id, node._id)
      .then(function () {
        _.find(vm.riskList, function (_risk) {
          if (_risk._id == risk._id) {
            _risk.node = _.reject(_risk.node, function (_task) {
              return _task._id == node._id;
            });
            return true;
          }
          return false;
        });

        commonService.populateRisks(node, vm.riskList);
      });
  }

  /**
   * Show search box for tasks.
   * @param {Risk} risk
   * @param {Event} evt
   */
  function showTaskSearch(risk, evt) {
    if (evt) {
      evt.stopPropagation();
    }

    risk.query = '';
    risk.searchFormFocused = !risk.searchFormFocused;
  }

  /**
   * Open Dropbox picker.
   * @param {Risk} risk
   * @param {Event} e
   */
  function addFromDropbox(risk, e) {
    if (e) {
      e.stopPropagation();
    }

    Dropbox.choose({
      success: function (files) {
        var file = files[0];
        var payload = {
          from: 'dropbox',
          bytes: file.bytes,
          link: file.link,
          name: file.name,
          added_at: new Date()
        };

        Risk
          .addFile(risk._id, payload)
          .then(function () {
            risk._files.push(payload);
            risk.isButtonsVisible = !risk.isButtonsVisible;
          });
      },
      linkType: 'preview'
    });
  }

  /**
   * Open Google Drive picker.
   * @param {Risk} risk
   * @param {Event} e
   */
  function addFromGoogle(risk, e) {
    if (e) {
      e.stopPropagation();
    }

    Picker.google($('.google'), function (files) {
      var file = files[0];
      var payload = {
        from: 'google',
        link: file.url,
        name: file.name,
        added_at: new Date()
      };

      Risk
        .addFile(risk._id, payload)
        .then(function () {
          $rootScope.currentNode._files.push(payload);
        });
    });
  }

  /**
   * Open OneDrive picker.
   * @param {Risk} risk
   * @param {Event} e
   */
  function addFromOneDrive(risk, e) {
    if (e) {
      e.stopPropagation();
    }

    OneDrive.open({
      success: function(files) {
        var file = files[0];
        var payload = {
          from: 'onedrive',
          bytes: file.size,
          link: file.link,
          name: file.fileName,
          added_at: new Date()
        };

        Risk
          .addFile(risk._id, payload)
          .then(function () {
            risk._files.push(payload);
            risk.isButtonsVisible = !risk.isButtonsVisible;
          });
      },

      cancel: function() {
      },

      linkType: "webViewLink", // or "downloadLink",
      multiSelect: false // or true
    });
  }

  /**
   * Called when clicking on 'Upload' button.
   * @param {Risk} risk
   */
  function uploadFile(risk) {
    // http://stackoverflow.com/a/19519023
    setTimeout(function () {
      // Open the file select dialog.
      angular.element('.upload-file[data-risk=' + risk._id + ']').click();
    }, 0);
  }

  /**
   * Called when a file is selected from the file dialog.
   */
  function onSelectFile(element) {
    if (!element.files[0]) {
      return;
    }

    var riskId = angular.element(element).attr('data-risk');

    Alert.info($i18next('riskView.uploading'));
    Risk
      .uploadFile(riskId, element.files[0])
      .then(function (res) {
        _.each(vm.riskList, function (risk) {
          if (risk._id == riskId) {
            risk._files.push(res);
          }
        });
      })
      .catch(function (error) {
        Alert.danger($i18next('riskView.failToUpload'));
      });
  }

  /**
   * Delete file from risk.
   * @param {Risk} risk
   * @param {Object} file
   * @param {Event} e
   */
  function deleteFile(risk, file, e) {
    if (e) {
      e.stopPropagation();
    }

    if (!confirm($i18next('riskView.deleteFileConfirm'))) {
      return;
    }

    Risk
      .deleteFile(risk._id, file._id)
      .then(function () {
        risk._files = _.reject(risk._files, function (_file) {
          return _file._id == file._id;
        });
      });
  }

  /**
   * Toggle buttons to add files.
   * @param {Risk} risk The risk for which buttons are visible.
   */
  function toggleButtons(risk) {
    risk.isButtonsVisible = !risk.isButtonsVisible;
  }

  /**
   * Sort risk table.
   * @param {String} orderColumn
   * @param {Event} $event
   */
  function sortTable(orderColumn, $event) {
    $($event.target).toggleClass('fa-caret-down, fa-caret-up');

    $scope.orderColumn = orderColumn;
    $scope.orderReverse = !$scope.orderReverse;
  }

  /**
   * Called when new risk is created from modal dialog.
   */
  function onRiskCreated() {
    vm.riskList = getRiskList();
  }
}

})();
