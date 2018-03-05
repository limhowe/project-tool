(function() {

'use strict';

/**
 * Controller for the page to create a new project.
 */
angular
  .module('App.controllers')
  .controller('ProjectCreateController', ProjectCreateController);

ProjectCreateController.$inject = ['$scope', '$rootScope', '$state', '$i18next', 'Project', 'Payment', 'Alert'];

function ProjectCreateController($scope, $rootScope, $state, $i18next, Project, Payment, Alert) {
  var vm = this;

  Alert.init($scope);

  /**
   * Details for a new project.
   * @type {Object}
   */
  vm.project = {};

  vm.onSubmit = onSubmit;

  // Check if the current plan is 'Free'.
  Payment.getPlan()
    .then(function (subscription) {
      //$scope.isFreePlan = (!subscription || subscription.plan.id === 'free');
      $scope.isFreePlan = false;
      if ($scope.isFreePlan) {
        Alert.warning($i18next('projectCreate.upgradePlan'));
      }
    })

  /**
   * Called when a form is submitted.
   * @param {Form} projectForm
   */
  function onSubmit(projectForm) {
    if (!projectForm.$valid) {
      return;
    }

    Project
      .create(vm.project)
      .then(function ($project) {
        $rootScope.projectCreated = true;
        $rootScope.$broadcast('new_project_created', $project);

        Alert.success($i18next('global.successfulCreate'));

        $state.go('default.project.list', {
          id: $project._id,
        });
      })
    .catch(function () {
      Alert.danger($i18next('projectCreate.failToSave'));
    });
  }
}

})();
