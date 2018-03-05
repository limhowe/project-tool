'use strict';

angular.module('App.services').service('Risk', function($rootScope, $http, $q) {
  var self = this;

  self.get_risks = function (projectId) {
    var deffered = $q.defer();
    $http
      .get('/api/project/risk/' + projectId)
      .success(deffered.resolve)
      .error(deffered.reject);
    return deffered.promise;
  };

  self.addRisk = function (payload) {
    var deffered = $q.defer();
    $http
      .post('/api/project/risk', payload)
      .success(function (data) {
        deffered.resolve(data);
      })
      .error(function (data) {
        deffered.reject(data.message);
      });

    return deffered.promise;
  };

  /**
   * Delete a risk.
   * @param {Risk} risk
   */
  self.deleteRisk = function (risk) {
    var deffered = $q.defer();
    $http
      .delete('/api/project/risk/' + risk._id)
      .success(function (data) {
        deffered.resolve(data);
      }).error(function (data) {
        deffered.reject(data.message);
      });

    return deffered.promise;
   };

  /**
   * Update risk.
   */
  self.updateRisk = function (riskId, payload) {
    var deffered = $q.defer();
    $http.put('/api/project/risk/' + riskId, payload)
      .success(deffered.resolve)
      .error(deffered.reject);
    return deffered.promise;
  };

  /**
   * Add task to risk.
   */
  self.add_node = function (riskId, nodeId) {
    var deffered = $q.defer();
    $http
      .put('/api/project/risk/add_node/' + riskId + '/' + nodeId)
      .success(deffered.resolve)
      .error(deffered.reject);
    return deffered.promise;
  };

  /**
   * Detach a risk from task.
   * @param {String} riskId
   * @param {String} nodeId
   */
  self.remove_node = function(riskId, nodeId) {
    var deffered = $q.defer();
    $http
      .put('/api/project/risk/remove_node/' + riskId + '/' + nodeId)
      .success(deffered.resolve)
      .error(deffered.reject);
    return deffered.promise;
   }

  self.addFile = function (risk_id, payload) {
    var deffered = $q.defer();
    var url = '/api/project/risk/' + risk_id + '/file';
    $http.post(url, payload)
      .success(deffered.resolve)
      .error(function (error) {
        deffered.reject(error.message);
      });

    return deffered.promise;
   };

  /**
   * Upload a file and add it to the specified risk.
   * @param {String} riskId
   * @param {File} fileObj
   * @return {Promise}
   */
  self.uploadFile = function (riskId, fileObj) {
    var defered = $q.defer();

    var formData = new FormData();
    formData.append('file', fileObj);

    var url = '/api/project/risk/' + riskId + '/upload';

    $http
      .post(url, formData, {
        transformRequest: angular.identity,
        headers: {
          'Content-Type': undefined
        }
      })
      .success(defered.resolve)
      .error(function (error) {
        defered.reject(error.message);
      });

    return defered.promise;
  };

  self.deleteFile = function (risk_id, file_id) {
    var deffered = $q.defer();
    var url = '/api/project/risk/' + risk_id + '/file/' + file_id;

    $http.delete(url)
      .success(deffered.resolve)
      .error(function (error) {
        deffered.reject(error.message);
      });

    return deffered.promise;
   };


});
