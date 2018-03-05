(function() {

'use strict';

/**
 * Controller for the home page that lists all projects.
 */
angular
  .module('App.controllers')
  .controller('ProjectListController', ProjectListController);

ProjectListController.$inject = ['$scope', '$rootScope', '$state', '$modal', '$timeout', '$i18next', 'Project', 'Analytics', 'Alert',  'User', 'Payment'];

function ProjectListController($scope, $rootScope, $state, $modal, $timeout, $i18next, Project, Analytics, Alert, User, Payment) {
  var vm = this;

  Analytics.pageTrack('/project');
  Alert.init($scope);

  /**
   * The list of projects created.
   * @type {Array}
   */
  vm.projectsCreated = [];

  /**
   * The list of projects shared.
   * @type {Array}
   */
  vm.projectsShared = [];

  $scope.ownProjectsLoaded = false;
  $scope.sharedProjectsLoaded = false;
  $scope.showTour = showTour;
  $scope.signout = signout;
  $scope.removeProject = removeProject;
  $scope.cloneProject = cloneProject;
  $rootScope.invite = $scope.invite = invite;

  $rootScope.newFeedActivity = false;
  $rootScope.isFeedVisible = false;
  $rootScope.toggleActivityFeed = toggleActivityFeed;
  $rootScope.showActivityFeed = showActivityFeed;
  $rootScope.hideActivityFeed = hideActivityFeed;

  $rootScope.$on('new_project_created', onNewProjectCreated);
  $rootScope.$on('project_deleted', onProjectDeleted);
  $rootScope.$on('project.updated', onProjectUpdated);

  Payment
    .getPlan()
    .then(function (subscription) {
      if (subscription && subscription.ending_at && !subscription.card && subscription.plan.id !== 'free') {
        $scope.currentSubscription = subscription;
        $scope.subscriptionLeft = moment(subscription.ending_at).format('LL');
      }
      $scope.isFreePlan = (!subscription || subscription.plan.id === 'free');
    })
    .catch(Alert.danger);

  Project
    .getList({
      type: 'created'
    })
    .then(function (projects) {
      vm.projectsCreated = projects;
      $scope.ownProjectsLoaded = true;

      User
        .me()
        .then(function (user) {
          // Change the locale according to the user account setting.
          $i18next.options.lng = user.language || 'en';

          if ($scope.currentSubscription) {
            moment.locale(user.language || 'en');
            $scope.subscriptionLeft = moment($scope.currentSubscription.ending_at).format('LL');
          }

          User.hasDemo().then(function (hasDemo){
            $scope.hasDemo = hasDemo;

            if (hasDemo && !user.has_seen_demo) {
              User.see_demo(user.email);
              $rootScope.$broadcast('showTour');
            }
		      });
        });
    });

  Project
    .getList({
      type: 'shared'
    })
    .then(function (projects) {
      vm.projectsShared = projects;
      $scope.sharedProjectsLoaded = true;
    });

  /**
   * Start the site tour.
   */
  function showTour() {
    $rootScope.$broadcast('showTour');
  }

  /**
   * Sign out the current user and redirect to the sign in page.
   */
  function signout() {
    User.signout()
    .then(function () {
      $state.go('not_authorized.signin');
    }).catch(function (error) {
      $state.go('not_authorized.signin');
    });
  }

  /**
   * Remove the project.
   * @param {Number} index The index number of project in vm.projectsCreated.
   */
  function removeProject(index) {
    if (!confirm($i18next('projectList.confirmDelete'))) {
      return;
    }

    vm.projectsCreated[index].$process = true;

    Project
      .remove(vm.projectsCreated[index]._id)
      .then(function () {
        vm.projectsCreated.splice(index, 1);
      })
      .catch(Alert.danger)
  }

  function invite(project) {
    var modalInstance = $modal.open({
      templateUrl: 'inviteModal.html',
      controller: 'ProjectInviteController',
      resolve: {
        project: function () {
          return project;
        }
      }
    });
  }

  function onNewProjectCreated(event, project) {
    $timeout(function () {
      if (vm.projectsCreated.indexOf(project) == -1) {
        vm.projectsCreated.push(project)
      } else {
        Alert.danger();
      }
    }, 0);
  }

  function onProjectDeleted(event, project) {
    $timeout(function () {
      vm.projectsCreated.splice(vm.projectsCreated.indexOf(project), 1);
    });
  }

  function onProjectUpdated() {
    loadMyProjects();

    Project
      .getList({
        type: 'shared'
      })
      .then(function (projects) {
        vm.projectsShared = projects;
      })
      .catch(Alert.danger);
  }

  /**
   * Load the list of projects created by user himself.
   */
  function loadMyProjects() {
    Project
      .getList({
        type: 'created'
      })
      .then(function (projects) {
        vm.projectsCreated = projects;
      })
      .catch(Alert.danger);
  }

  /**
   * Clone an existing project.
   * @param {Object} project The project to clone.
   */
  function cloneProject(project) {
    Project
      .clone(project._id)
      .then(function () {
        loadMyProjects();
      })
      .catch(Alert.danger);
  }

  /**
   * Toggle activity feed.
   */
  function toggleActivityFeed() {
    if (!$rootScope.isFeedVisible) {
      $rootScope.$broadcast('showActivityFeed');
    }

    $timeout(function () {
      $rootScope.isFeedVisible = !$rootScope.isFeedVisible;
    }, 0);
  }

  /**
   * Show activity feed.
   */
  function showActivityFeed() {
    if (!$rootScope.isFeedVisible) {
      $rootScope.$broadcast('showActivityFeed');
    }

    $timeout(function () {
      $rootScope.isFeedVisible = true;
    }, 0);
  }

  /**
   * Hide activity feed.
   */
  function hideActivityFeed() {
    $timeout(function () {
      $rootScope.isFeedVisible = false;
    }, 0);
  }

}

})();
