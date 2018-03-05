(function() {
  'use strict';

  /**
   * Controller for sign-in page.
   */
  angular
    .module('App.controllers')
    .controller('SigninController', SigninController);

  SigninController.$inject = ['$scope', '$rootScope', '$location', '$window', '$i18next', '$state', 'User', 'Alert'];

  function SigninController($scope, $rootScope, $location, $window, $i18next, $state, User, Alert) {
    var vm = this;

    Alert.init($rootScope);

    vm.login = login;
    vm.authGoogle = authGoogle;
    vm.authLinkedin = authLinkedin;
    vm.authLive = authLive;

    /**
     * Keep user credentials entered with the following keys:
     *   - {String} username
     *   - {String} password
     * @type {Object}
     */
    vm.user = {};

    $rootScope.body_class = 'signin';

    /**
     * Login user.
     * @param {Form} userForm
     */
    function login(userForm) {
      if (!userForm.$valid) {
        return;
      }

      User
        .signin(vm.user)
        .then(function (user, redirect) {
          $rootScope.body_class = '';

          // Change the locale according to the user account setting.
          $i18next.options.lng = user.language || 'en';

          if (redirect && redirect.model == 'Project' && redirect.action == 'show' && redirect.param.id) {
            $state.go('default.project.list', {
              id: redirect.param.id
            });
          } else if (user && user.should_pay) {
            $state.go('default.account', {
              tab: 'payments',
              redirect: 'signin'
            });
          } else {
            $state.go('default.projects');
          }
        })
        .catch(function(error){
		Alert.danger($i18next(error));
		});
    }

    /**
     * Authenticate with Google.
     */
    function authGoogle() {
      $window.location.href = getSiteUrl() + '/auth/google';
    }

    /**
     * Authenticate with LinkedIn.
     */
    function authLinkedin() {
      $window.location.href = getSiteUrl() + '/auth/linkedin';
    }

    /**
     * Authenticate with Windows Live.
     */
    function authLive() {
      $window.location.href = getSiteUrl() + '/auth/live';
    }

    /**
     * Retrieve full site URL.
     */
    function getSiteUrl() {
      return $location.protocol() + '://' + $location.host() + ':' + $location.port();
    }
  }
})();
