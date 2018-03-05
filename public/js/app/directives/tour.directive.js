(function() {
  'use strict';

  /**
   * The tour directive.
   */
  angular
    .module('App')
    .directive('phTour', phTour);

  phTour.$inject = [];

  function phTour() {
    return {
      restrict: 'A',
      controller: ['$scope', '$rootScope' ,'$element', '$timeout', '$state', '$q', 'Project', 'User', Controller],
      controllerAs: 'vm',
      bindToController: true,
      templateUrl: 'views/directives/tour'
    };

    function Controller($scope, $rootScope, $element, $timeout, $state, $q, Project, User) {
      var vm = this;
      /**
       * The current step.
       * @type {Number|null} null to hide the tour.
       */
      vm.currentStep = null;

      /**
       * The tour details.
       * @type {Array}
       */
      vm.steps = [
        {
          title: 'tour.taskDetails',
          name: "List View",
          content: 'tour.listViewContent',
          state: 'default.project.list',
          requiredStateParam: 'id',
          requiredInitializer: 'fetchProjectData',
          activeTask: true,
        },
        {
          title: 'tour.wbsChart',
          name: "Detail View",
          content: 'tour.detailViewContent',
          state: 'default.project.detailed',
          requiredStateParam: 'id',
          requiredInitializer: 'hideTaskForm',
        },
        {
          title: 'tour.ganttChart',
          name: "GANTT View",
          content: 'tour.ganttViewContent',
          state: 'default.project.gantt',
          requiredStateParam: 'id',
        },
        {
          title: 'tour.agileArea',
          name: "AGILE",
          content: 'tour.agileContent',
          state: 'default.project.agile',
          requiredStateParam: 'id',
          requiredInitializer: 'fetchProjectData'
        },
        {
          title: 'tour.raciChart',
          name: "RACI",
          content: 'tour.raciContent',
          state: 'default.project.raci',
          requiredStateParam: 'id',
          requiredInitializer: 'fetchProjectData'
        },
        {
          title: 'tour.riskRegister',
          name: "Risks",
          content: 'tour.riskContent',
          state: 'default.project.risk',
          requiredStateParam: 'id',
          requiredInitializer: 'refreshTree'
        },
        {
          title: 'tour.settings',
          name: "SETTINGS",
          content: 'tour.settingsContent',
          state: 'default.project.manage',
          requiredStateParam: 'id',
          requiredInitializer: 'refreshTree'
        },
        // {
        //   title: 'tour.freeMonth',
        //   content: 'tour.freeMonthContent',
        //   state: 'default.referral',
        // },
        {
          title: 'tour.account',
          content: 'tour.accountContent',
          state: 'default.account',
          requiredStateParam: 'tab',
          tab: 'profile'

        },
        {
          title: 'tour.payments',
          content: 'tour.paymentsContent',
          state: 'default.account',
          requiredStateParam: 'tab',
          tab: 'payments'
        },
        {
          title: 'tour.collaborators',
          content: 'tour.collaboratorsContent',
          state: 'default.account',
          requiredStateParam: 'tab',
          tab: 'collaborators'
        },
        {
          title: 'tour.goodTalk',
          content: 'tour.goodTalkContent',
          state: 'default.projects'
        }
      ];

      /**
       * CSS style for popover positioning.
       * @type {Object}
       */
      vm.popoverPosition = {
        'margin-left': -138,
        'margin-top': 0
      };

      vm.gotoPrev = gotoPrev;
      vm.gotoNext = gotoNext;
      vm.endTour = endTour;

      /**
       * The popover element.
       * @type {jQuery}
       */
      var $popover = angular.element('.popover', $element);

      $scope.$on('showTour', showTour);

      /**
       * Start the tour upon receiving 'showTour' event.
       */
      function showTour() {
        $state.go('default.projects');

        $timeout(function () {
          $rootScope.tourOn = true;
        }, 100);
        showStep(0);
      }

      /**
       * Move to the previous step.
       * Called when clicking on 'Prev' button.
       */
      function gotoPrev() {
        showStep(vm.currentStep - 1);
      }

      /**
       * Move to the next step.
       * Called when clicking on 'Next' button.
       */
      function gotoNext() {
        showStep(vm.currentStep + 1);
      }

      /**
       * End a tour.
       * Called when clicking on 'End' button.
       */
      function endTour() {
        $state.go('default.projects');
        $timeout(function () {
          $rootScope.tourOn = false;
          showStep(null);
        }, 1500);
      }

      /**
      * Set click listener to turn of tour on click-off
      */
      $(document).click(function (event) {
        if ($rootScope.tourOn) {
          if (!$(event.target).closest(".popover").length) {
            endTour();
          }
        }
      });

      /**
       * Navigate and show the step.
       * @param {int} step
       */
      function showStep(step) {
        if (step !== null && (step < 0 || step >= vm.steps.length)) {
          return;
        }
        vm.currentStep = step;

        // When it is about to end the tour, exit.
        if (vm.currentStep === null) {
          //-- add redirect to project list
          return;
        }

        // Navigiate to the proper page.
        var stepDetails = vm.steps[vm.currentStep];
        if (!_.isUndefined(stepDetails.state)) {
          if (!_.isUndefined(stepDetails.requiredStateParam)) {
            if (stepDetails.requiredStateParam == 'id') {
              getProjectId().then(function (res) {
                $state
                  .go(stepDetails.state, {
                    id: res.id
                  })
                  .then(onStateChange);
              });
            } else if (stepDetails.requiredStateParam == 'tab') {
              // Open the user profile page.
              $state
                .go(stepDetails.state, {
                  tab: stepDetails.tab
                })
                .then(onStateChange);
            }
          } else {
            $state
              .go(stepDetails.state)
              .then(onStateChange);
          }
        }

        // Wait until DOM elements are updated.
        $timeout(function() {
          // Center-position the popover.
          vm.popoverPosition = {
            'margin-left': -$popover.outerWidth() / 2,
            'margin-top': -$popover.outerHeight() / 2
          };
        }, 0);

        function onStateChange() {
          $rootScope.changeView(vm.steps[vm.currentStep].name);

          // Run required functions for view init.
          // Open task form if view has active task.
          // Close the task form if needed.
          if (stepDetails.requiredInitializer) {
            if (stepDetails.requiredInitializer == 'fetchProjectData') {
              getProjectId().then(function (res) {
                $rootScope[stepDetails.requiredInitializer](res.id, function () {
                  if (stepDetails.activeTask && $rootScope.tree.length) {
                    $rootScope.selectNode($rootScope.tree[0]);
                  }
                });
              });
            } else {
              $timeout(function () {
                $rootScope[stepDetails.requiredInitializer](null, function () {
                  if (stepDetails.activeTask && $rootScope.tree.length) {
                    $rootScope.selectNode($rootScope.tree[0]);
                  }
                });
              }, 1000);
            }
          }
        }
      }

      /**
       * Retrieve the project ID to use for tour.
       * If the current page shows a project details, use that project.
       * Otherwise use one of the demo projects.
       * @return {Promise} On successful, 'id' resolves to the project ID.
       * Replace the project id for changing demo project.
       */
      function getProjectId() {
        var deferred = $q.defer();

        // TODO: Can we cache the demo project ID?
        // TODO: Can we use Project.get_demo_project()?
        User
          .me()
          .then(function (user) {
            Project
              .get_user_demo(user._id)
              .then(function (demo) {
                deferred.resolve({
                  id: demo._id,
                });
              })
              .catch(function() {
                deferred.reject();
              });
          });

        return deferred.promise;
      }
    }
  }
})();
