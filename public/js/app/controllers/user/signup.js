(function() {
  'use strict';

  /**
   * Controller for sign-up page.
   */
  angular
    .module('App.controllers')
    .controller('SignupController', SignupController);

  SignupController.$inject = ['$scope', '$location', '$timeout', '$rootScope', '$stateParams', '$window', '$i18next', '$state', 'User', 'Alert', 'APP_SETTING', 'Testimonial'];

  function SignupController($scope, $location, $timeout, $rootScope, $stateParams, $window, $i18next, $state, User, Alert, APP_SETTING, Testimonial) {
    Alert.init($rootScope);
    $rootScope.body_class = 'signup';

    $scope.testimonial = Testimonial.random();

    // Retrieve the list of languages supported.
    $scope.languages = APP_SETTING.LANGUAGES;

    $scope.changeLanguage = changeLanguage;

    User.signout().then(function () {
      $scope.user = {
        // Load the default language from query param 'lang'.
        language: $stateParams.lang || 'en',
      };

      changeLanguage();

      $scope.invitedEmails = [];

      if (User.isLogged()) {
        return $location.url('/');
      }

      if ($stateParams.email) {
        $scope.user.email = $stateParams.email;
        $scope.emailAlreadySet = true;
      }

      User
        .invitedEmails()
        .then(function (emails) {
          $scope.invitedEmails = emails;
        })
        .catch(Alert.danger);

      $scope.signup = function (user, userForm) {
        if (!userForm.$valid || $scope.adding) {
          return;
        }

        $scope.adding = true;
        var data = {
          username: user.username,
          email: user.email,
          password: user.password,
          type: $stateParams.type,
          language: user.language,
          user_id: $stateParams.user_id
        };

        User
          .signup(data)
          .then(function (user) {
            var loginData = {
              username: data.username,
              password: data.password
            };

            User
              .signin(loginData)
              .then(function (user, redirect) {
                $rootScope.body_class = '';
                $rootScope.play_the_fuckin_tour = true;
                $scope.adding = false;
                if (redirect && redirect.model == 'Project' && redirect.action == 'show' && redirect.param.id) {
                  $location.url('/project/' + redirect.param.id + '/show');
                } else if (user && user.should_pay) {
                  //user.pay_reason
                  $location.url('/account/payments');
                } else {
                  $state.go('default.projects');
                }
              });
          })
          .catch(function (errors) {
            $scope.adding = false;
            $scope.error = $i18next('signUp.emailOrUsernameExists'); //"Email or username already exists";
            $timeout(function () {
              $scope.error = false;
            }, 5000);
          });
      };

      $scope.socialAuth = function (provider) {
        var params = [
          'language=' + $scope.user.language,
        ];

        if ($stateParams.type) {
          params.push('type=' + $stateParams.type);
          params.push('user_id=' + $stateParams.user_id);
        }

        params = '?' + params.join('&');

        $window.location.href = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/auth/' + provider + params;
      };
    });

    /**
     * Change the language.
     * Called when a language is switched from select box or during the initialization.
     */
    function changeLanguage() {
      $i18next.options.lng = $scope.user.language;
    }
  }
})();
