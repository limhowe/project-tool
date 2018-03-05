(function() {

'use strict';

/**
 * Controller for project settings page.
 */
angular
  .module('App.controllers')
  .controller('ProjectManageController', ProjectManageController);

ProjectManageController.$inject = ['$scope', '$rootScope', '$stateParams', '$i18next', '$timeout', 'Project', 'Alert', 'Time', 'DateFormat', 'Export'];

function ProjectManageController($scope, $rootScope, $stateParams, $i18next, $timeout, Project, Alert, Time, DateFormat, Export) {
  var vm = this;

  Alert.init($scope);

  /**
   * The list of timezones and dateformats.
   * @type {Array}
   */
  vm.timezones = Time.timezones();
  vm.dateformats = DateFormat.formats();

  /**
   * The current project being edited.
   * @type {Project}
   */
  vm.project = null;
  vm.isLoading = false;

  vm.updateProjectName = updateProjectName;
  vm.updateProjectDescription = updateProjectDescription;
  vm.updateProjectTimezone = updateProjectTimezone;
  vm.updateProjectDateformat = updateProjectDateformat;
  vm.updateProjectGanttStartDate = updateProjectGanttStartDate;
  vm.inviteCollaborator = inviteCollaborator;
  vm.removeCollaborator = removeCollaborator;
  vm.exportProject = exportProject;
  vm.exportAsMSProject = exportAsMSProject;
  vm.importMSProject = importMSProject;

  var $fileMSProject = angular.element('#file-ms-project');

  $fileMSProject.change(onFileMSProjectSelect);


  Project
    .get($stateParams.id)
    .then(function (project) {
      vm.project = project;

      if (project.image) {
        Project
          .getImage(vm.project.id)
          .then(function (image) {
            vm.project.image = image;
          });
      }
    })
    .catch(Alert.danger);


  /**
   * Update the project name.
   */
  function updateProjectName() {
	if (!vm.project.name) {
	  vm.project.name = $rootScope.project.title;
	  Alert.danger($i18next('projectSettings.projectNameCanNotBeBlank'));
	  return;
	}

    Project
      .update(vm.project.id, {
        name: vm.project.name,
      })
      .then(function () {
		$rootScope.project.title = vm.project.name;
        Alert.success($i18next('projectSettings.successfulUpdate'));
        $scope.$emit('project.updated');
      }, function(resp){
		if (resp.status==403) {
		  Alert.danger($i18next('projectSettings.collaboratorsCanNotUpdate'));
		}
	  });
  }

  /**
   * Update the project desc.
   */
  function updateProjectDescription() {

    Project
      .update(vm.project.id, {
        description: vm.project.description,
      })
      .then(function () {
        Alert.success($i18next('projectSettings.successfulUpdate'));
        $scope.$emit('project.updated');
      }, function(resp){
		if (resp.status==403) {
		  Alert.danger($i18next('projectSettings.collaboratorsCanNotUpdate'));
		}
	  });
  }

  /**
   * Update the project timezone.
   */
  function updateProjectTimezone() {
    Project
      .update(vm.project.id, {
        timezone: vm.project.timezone,
      })
      .then(function () {
        Alert.success($i18next('projectSettings.successfulUpdate'));
        $scope.$emit('project.updated');
      }, function(resp){
		if (resp.status==403) {
		  Alert.danger($i18next('projectSettings.collaboratorsCanNotUpdate'));
		}
	  });
  }

  /**
   * Update the project date format.
   */
  function updateProjectDateformat() {
    Project
      .update(vm.project.id, {
        dateformat: vm.project.dateformat,
      })
      .then(function () {
        Alert.success($i18next('projectSettings.successfulUpdate'));
        $scope.$emit('project.updated');
      }, function(resp){
    if (resp.status==403) {
      Alert.danger($i18next('projectSettings.collaboratorsCanNotUpdate'));
    }
    });
  }

    /**
     * Update the project gantt start date.
     */
    function updateProjectGanttStartDate() {

      $rootScope.project.settings.gantt_start_date = vm.project.settings.gantt_start_date;

      Project
        .update(vm.project.id, {'settings': $rootScope.project.settings})
        .then(function () {
          Alert.success($i18next('projectSettings.successfulUpdate'));
          $scope.$emit('project.updated');
        }, function(resp){
      if (resp.status==403) {
        Alert.danger($i18next('projectSettings.collaboratorsCanNotUpdate'));
      }
      });

    }

  /**
   * Called when a 'Invite' link is clicked.
   * Open an invite dialog.
   */
  function inviteCollaborator() {
    $rootScope.invite(vm.project);
  }

  /**
   * Remove a collaborator from the project.
   * @param {Number} index The index number of collaborator in vm.project._users.
   */
  function removeCollaborator(index) {
    if (!confirm($i18next('projectSettings.removeUserConfirm'))) {
      return;
    }

    var collaborator = vm.project._users[index];

    Project
      .rejectUser(vm.project, collaborator.invite_email || collaborator.user.email)
      .then(function () {
        vm.project._users.splice(index, 1);
      });
  }

  /**
   * Export project tasks as CSV.
   */
  function exportProject() {
	vm.isLoading = true;
    Alert.info($i18next('projectSettings.waitWhileExport'), false);
    Export.exportProject(vm.project.id, function () {

	  $timeout(
		function () {
		  vm.isLoading = false;
  	      Alert.success($i18next('projectSettings.successfulExport'));
		}
	  , 4000);

	});

  }

  /**
   * Export tasks as MS project file.
   */
  function exportAsMSProject() {
	vm.isLoading = true;
    Alert.info($i18next('projectSettings.waitWhileExport'), false);
    Project
      .exportAsMSProject(vm.project.id)
      .then(function () {
		$timeout(
		  function () {
			vm.isLoading = false;
            Alert.success($i18next('projectSettings.successfulExport'));
		  }
		, 4000);
      });
  }

  /**
   * Import tasks from MS Project file.
   * Open a file browser to select a MS Project file.
   */
  function importMSProject() {
    $timeout(function () {
      $fileMSProject[0].value = null;
      $fileMSProject.click();
    });
  }

  /**
   * Called when a file is selected from the file browser.
   */
  function onFileMSProjectSelect() {
    // If no file is selected, return.
    if (!$fileMSProject[0].files.length) {
      return;
    }

    Project
      .importMSProject(vm.project.id, $fileMSProject[0].files[0])
      .then(function () {
        Alert.success($i18next('projectSettings.successfulImport'));
      });
  }
}

})();
