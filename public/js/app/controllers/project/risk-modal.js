(function() {

'use strict';

/**
 * Controller for risk modal dialogs.
 */
angular
  .module('App.controllers')
  .controller('riskModalController', riskModalController);

riskModalController.$inject = ['$scope', '$rootScope','$modalInstance', '$stateParams', 'Risk'];

function riskModalController($scope, $rootScope, $modalInstance, $stateParams, Risk) {
  $scope.currentRisk = $scope.$root.currentRisk;

  $scope.$risk = {};

  $scope.editRisk = editRisk;
  $scope.addRisk = addRisk;
  $scope.close = close;

  /**
   * Called when Update button is clicked after editing risk details.
   */
  function editRisk() {
    var payload = {
      consequence: $scope.currentRisk.consequence,
      contingency: $scope.currentRisk.contingency,
      impact: $scope.currentRisk.impact,
      level: $scope.currentRisk.level,
      mitigation: $scope.currentRisk.mitigation,
      name: $scope.currentRisk.name,
      probability: $scope.currentRisk.probability,
      topic: $scope.currentRisk.topic
    };
    $scope.currentRisk.score =  $scope.currentRisk.probability *  $scope.currentRisk.impact;
    Risk
      .updateRisk($scope.currentRisk._id, payload)
      .then(function () {
        close();
      });
  }

  $scope.addRisk = function (node, form) {
    if (!form.$valid) {
      return;
    }

    $scope.$risk.project = $stateParams.id;
    Risk.addRisk($scope.$risk).then(function (risk) {
      $scope.$risk = false;
      $scope.$root.$broadcast('risk_created', risk);
      //$rootScope.currentNode = {};
      close();
    });
  };

  /**
   * Called when Add button is clicked after entering new risk details.
   */
  function addRisk(node, form) {
    var node_id = node._id || node.node_id;
    if (!form.$valid || !node_id) {
      return;
    }

    $scope.$risk.project = $stateParams.id;
    $scope.$risk.node = node_id;
    Risk
      .addRisk($scope.$risk)
      .then(function (risk) {
        risk.score = risk.probability * risk.impact;
        $scope.$root.$broadcast('risk_created');
        $scope.$risk = false;
        $rootScope.currentNode.risks.push(risk);
        close();
      });
  }

  /**
   * Close dialog.
   */
  function close() {
    $modalInstance.close();
  };
}

})();
