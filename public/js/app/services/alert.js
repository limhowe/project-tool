'use strict';

angular.module('App.services')
.service('Alert', function ($timeout) {
  var self = this;

  this.init = function (scope) {
    self.scope = scope;
    self.clear();
  };

  this.success = function (text, autoDismiss) {
    showMessage(text, 'success', 'alert-success', autoDismiss);
  };

  this.info = function (text, autoDismiss) {
    showMessage(text, 'info', 'alert-info', autoDismiss);
  };

  this.warning = function (text, autoDismiss) {
    showMessage(text, 'warning', 'alert-warning', autoDismiss);
  };

  this.danger = function (text, autoDismiss) {
    showMessage(text, 'danger', 'alert-danger', autoDismiss);
  };

  this.clear = function () {
    self.scope.message = null;
  };

  function showMessage(text, type, alertType, autoDismiss) {
    if (!text) {
      return;
    }

    self.scope.message = {
      type: type,
      text: text,
      alertType: alertType,
    };

    if (_.isUndefined(autoDismiss) || autoDismiss < 3000 ) {
      $timeout(function () {
        self.clear();
      }, 3000);
    } else {
      $timeout(function () {
        self.clear();
      }, autoDismiss);
    }
  }
});
