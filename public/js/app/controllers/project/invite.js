'use strict';

angular.module('App.controllers').controller('ProjectInviteController', ['$scope', '$rootScope', '$modalInstance', 'Project', 'project', 'Alert', 'User', 'Payment', 'Plan', '$i18next',
    function ($scope, $rootScope, $modalInstance, Project, project, Alert, User, Payment, Plan, $i18next) {
      Alert.init($scope);

      // Retrieve the current subscription plan.
      Payment
        .getPlan()
        .then(function(subscription) {
          if (subscription) {
            $scope.maxUsers = subscription.plan.max_users;
          } else {
            $scope.maxUsers = 0;
          }

          // Get the next subscription plan available.
          // For example, if the current plan is '1to3', then the next plan will be '3to10'.
          Plan
          .get()
          .then(function(plans) {
            plans = _.sortBy(plans, function(plan) {
              if (plan.max_users === true) {
                return 999999;
              } else if (plan.max_users === false) {
                return 0;
              } else {
                return plan.max_users;
              }
            });

            var currentPlanIndex = 0;
            if (subscription) {
              currentPlanIndex = _.findIndex(plans, function(plan) {
                return plan._id == subscription.plan._id;
              });
            }
            // We assume that the last plan is always 'Unlimited'.
            if (currentPlanIndex < plans.length - 1) {
              $scope.nextPlan = plans[currentPlanIndex + 1].name;
            } else {
              $scope.nextPlan = subscription ? subscription.plan.name : '';
            }
          });
        });

      $scope.shared_users = []
      $scope.invited_users = [];

      $scope.update = function () {
        Project.get(project._id)
        .then(function (data) {
          $scope.shared_users = _.chain(data._users).map(function (u) { return u.user; }).compact().value();
          $scope.invited_users = _.chain(data._users).filter(function (u) { return ! u.user; }).compact().value();
        });
      };

      $scope.update();

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };

      $scope.submit = function (invited_user) {
        var payload = {
          project: project._id,
          email: invited_user.email
        };

        Project.invite(payload).then(function (data) {
          var raci_payload = {
            project: project._id,
            resource: invited_user.email,
            type: 'raci_tab'
          };
          project._users.push(data);
          Project.addRaci(raci_payload);
          $scope.update();
          $scope._data = data
          $rootScope.$broadcast( 'collaborator_invited', $scope._data );
          $scope.invited_user = null;
		      Alert.success($i18next('invite.collaboratorInvited'));
        })
        .catch(Alert.danger);
      };

      $scope.reject = function (user, index, from_waiting) {
        user.$rejecting = true

        var userEmail = user.email || user.invite_email;

        Project
          .rejectUser(project, userEmail)
          .then(function () {
            project._users = _.reject(project._users, function (_user) {
              return _user.user.email == userEmail;
            });

            $scope.update();
            user.$rejecting = false;
          });
      };

    }
  ])
