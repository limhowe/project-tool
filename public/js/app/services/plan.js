'use strict';

angular.module('App.services')
  .service('Plan', function($http, $q) {
    var self = this;

    self.get = function () {
      var deffered = $q.defer();

      $http
        .post('/api/plan/get')
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };
  });
