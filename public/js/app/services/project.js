'use strict';

angular.module('App.services')
  .service('Project', function($rootScope, $http, $q, $window) {
    var self = this;

    self.create = function (payload) {
      var deffered = $q.defer();

      $http.post('/api/project', payload)
        .success(function (data) {
          deffered.resolve(data.project);
        })
        .error(function (data) {
          console.log(data)
          deffered.reject(data);
        });

      return deffered.promise;
    };

    self.get = function (id) {
      var deffered = $q.defer();
      var url = '/api/project/' + id;

      $http.get(url)
        .success(function (project) {
          deffered.resolve(project);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.getList = function (payload) {
      var deffered = $q.defer();

      $http.post('/api/project/list', payload)
        .success(function (data) {
          deffered.resolve(data.projects);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.invite = function (payload) {
      var deffered = $q.defer();

      $http.post('/api/project/invite', payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.rejectUser = function (projectId, email) {
      var deffered = $q.defer();
      $http
        .post('/api/project/reject_user', {
          project_id: projectId, email: email
        })
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.update = function (projectId, payload) {
      var deffered = $q.defer();
      $http
        .put('/api/project/' + projectId, payload)
        .then(function (data) {
          deffered.resolve();
        },function (data) {
          deffered.reject(data);
        });
      return deffered.promise;
    };

    self.remove = function (projectId) {
      var deffered = $q.defer();
      $http
        .post('/api/project/delete', {
          project_id: projectId
        })
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Clone an existing project.
     * @param {String} projectId The project ID to clone.
     */
    self.clone = function (projectId) {
      var defered = $q.defer();

      $http
        .post('/api/project/' + projectId + '/clone', {})
        .success(function () {
          defered.resolve();
        })
        .error(function (data) {
          defered.reject(data.message);
        });

      return defered.promise;
    };

    self.getImage = function (projectId) {
      var deffered = $q.defer();
      $http
        .get('/api/project/' + projectId + '/image?buffer=true')
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data);
        });
      return deffered.promise;
    };

    self.setImage = function (projectId, form_data) {
      var deffered = $q.defer();
      $http
        .post('/api/project/' + projectId + '/image', form_data, {
          withCredentials: true,
          headers: {'Content-Type': undefined },
          transformRequest: angular.identity
        })
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Add new RACI.
     * @param {Object} payload
     */
    self.addRaci = function (payload) {
      var deffered = $q.defer();
      $http
        .post('/api/project/' + payload.project + '/raci', payload)
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

    self.updateRaci = function (projectId, raciId, payload) {
      var deffered = $q.defer();
      $http
        .put('/api/project/' + projectId + '/raci/' + raciId, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

    self.deleteRaci = function (projectId, raciId) {
      var deffered = $q.defer();
      $http
        .delete('/api/project/' + projectId + '/raci/' + raciId)
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

    self.deleteResource = function (projectId, resource) {
      var deffered = $q.defer();
      $http
        .delete('/api/project/' + projectId + '/resource/' + resource)
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

    self.getRaciList = function (projectId) {
      var deffered = $q.defer()
      $http
        .get('/api/project/' + projectId + '/raci')
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.getActivityList = function (projectId, page) {
      var deffered = $q.defer()
      $http
        .get('/api/project/' + projectId + '/activity/' + page)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.getLastActivity = function(projectId) {
      var deffered = $q.defer();
      var url = '/api/project/' + projectId + '/last_activity/';

      $http.get(url)
	    .then(
        function (response) {
          deffered.resolve(response.data.last_activity);
        },
        function () {
          deffered.reject();
        }
      );

      return deffered.promise;
    }

    self.get_demo_project = function(user){
      var deffered = $q.defer()
      $http.get('/api/project/get_demo_project/')
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          console.log(data)
          deffered.reject(data.message);
        });
      return deffered.promise;
    }

    self.get_user_demo = function(userId){
      var deffered = $q.defer()
      $http.get('/api/project/demo/get_users/' + userId)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          console.log(data)
          deffered.reject(data.message);
        });
      return deffered.promise;
    }

    self.exportAsMSProject = exportAsMSProject;
    self.importMSProject = importMSProject;

    /**
     * Export tasks as MS project file.
     * @param {String} projectId The project ID to export.
     */
    function exportAsMSProject(projectId) {
      var deferred = $q.defer();

      $http
        .get('/api/project/' + projectId + '/export-as-ms-project')
        .success(function (data) {
          $window.location.href = data.path;
          deferred.resolve();
        })
        .error(function () {
          deferred.reject();
        });

      return deferred.promise;
    }

    /**
     * Import a MS project file.
     * @param {String} projectId
     * @param {File} file
     * @return {Promise}
     */
    function importMSProject(projectId, file) {
      var deferred = $q.defer();

      var formData = new FormData();
      formData.append('file', file);

      $http
        .post('/api/project/' + projectId + '/import-ms-project', formData, {
          transformRequest: angular.identity,
          headers: {
            'Content-Type': undefined
          },
        })
        .success(function () {
          deferred.resolve();
        })
        .error(function () {
          deferred.reject();
        });

      return deferred.promise;
    }
  });
