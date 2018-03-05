'use strict';

angular.module('App.controllers')
  .controller('ConfirmationController', ['$scope', '$location', '$rootScope', '$stateParams', '$i18next', '$window', 'User',
    function ($scope, $location, $rootScope, $stateParams, $i18next, $window, User) {
      $scope.user = {};
      $rootScope.body_class = 'confirmation';

      $scope.login = function (user, userForm) {
        if (!userForm.$valid) {
          return;
        }

        User
          .signin({
            username: user.username,
            password: user.password
          })
          .then(function (user, redirect) {
            $rootScope.body_class = '';
            if (redirect && redirect.model == 'Project' && redirect.action == 'show' && redirect.param.id) {
              $location.url('/project/' + redirect.param.id + '/show');
            } else if (user && user.should_pay) {
              $location.url('/account/payments');
            } else {
              $location.url('/');
            }
          })
          .catch(function (errors) {
            $scope.error = errors;
          });
      };

      $scope.authGoogle = function() {
        $window.location.href = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/auth/google';
      };

      $scope.authLinkedin = function() {
        $window.location.href = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/auth/linkedin';
      };

      $scope.authLive = function () {
        $window.location.href = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/auth/live';
      };

      User
        .confirm($stateParams.code)
        .then(function (res) {
          $scope.is_confirmed = true;
          $scope.user.username = $stateParams.email;

          // Change the locale according to the user account setting.
          $i18next.options.lng = res.language;
        });
    }
  ])
  .controller('AccountEditController', ['$scope', '$location', '$rootScope','$stateParams', '$i18next', 'User', 'Analytics', 'Alert', 'APP_SETTING', '$timeout', 'Payment',
    function ($scope, $location, $rootScope, $stateParams, $i18next, User, Analytics, Alert, APP_SETTING, $timeout, Payment) {
      Analytics.pageTrack('/account');
      Alert.init($scope);

      // Retrieve the list of languages supported.
      $scope.languages = APP_SETTING.LANGUAGES;

      $scope.user = {};
      $scope.tab = {
        profile: false,
        payments: false,
        collaborators: false
      };
      $scope.tab[$stateParams.tab] = true;

      if ($stateParams.redirect && $stateParams.redirect == 'signin') {
        Payment
          .getPlan()
          .then(function (subscription) {
            if (!subscription || subscription.plan.id === 'free') {
              Alert.init($scope);
              Alert.danger($i18next('account.freeTrialShouldPay'),30000);
            }
          })
          .catch(Alert.danger);
      }

      User
        .me()
        .then(function (user) {
          $scope.user = user;

          User
            .getImage(user._id)
            .then(function (image) {
              $scope.user.image = image;
			        $scope.user.avatar = $scope.user.avatar + '?' + (new Date).getTime();
            });
        })
        .catch(function (error) {
          $location.url('/signin');
        });

      $scope.uploadDialog = function () {
          $timeout(function () {
            angular.element('.image-uploader-form input[type="file"]')[0].value = null;
            angular.element('.image-uploader-form input[type="file"]').click();
          });
      };

      $scope.upload = function () {
        var files = angular.element('.image-uploader-form input[type="file"]')[0].files;
        var fd = new FormData();
        fd.append("image", files[0]);

        User
          .setImage($scope.user._id, fd)
          .then(function () {
            var image_url = '/api/user/' + $scope.user._id +'/image?' + (new Date).getTime();
            angular.element('.image-uploader-form img.user-picture').attr('src', image_url);
			      $timeout(function(){ $scope.user.avatar = image_url + '?' + (new Date).getTime(); }, 0);
          }, function () {
            $scope.errorImage = $i18next('account.unsupportedFileType');
			      $timeout(function () { $scope.errorImage = null; }, 3000);
		      })
          .catch(function (error) {
          });
      };

      $scope.update = function (user, userForm) {
        if (!userForm.$valid) {
          return;
        }

if (user.current_password) {
  User.isPassword(user.current_password)
  .then(function(is_password){
    if (is_password==true) {
      updateUser(true);
    } else {
      $scope.errors = [$i18next('account.invalidCurrentPassword')];
			$timeout(function () { $scope.errors = null; }, 3000);
    }
  });
} else {
  updateUser(false);
}

function updateUser(updatePassword){
        var data = {
          username: user.username,
          email: user.email,
          first_name: user.name.first,
          last_name: user.name.last,
          address: user.address,
          city: user.city,
          state: user.state,
          zip: user.zip,
          country: user.country,
          // By default, English is selected.
          language: user.language || 'en',
        };

if (updatePassword==true) {
  data.password = user.password;
}

        User
          .update(data)
          .then(function () {
            // Change the locale according to the user selection.
            $i18next.options.lng = user.language || 'en';

            $scope.errors = null;
            //Alert.success($i18next('global.successfulUpdate'));
            $scope.successfulUpdate = $i18next('global.successfulUpdate');
            $timeout(function () { $scope.successfulUpdate = null; }, 3000);
          })
          .catch(function (errors) {
            angular.forEach(errors, function(error, index){
              errors[index] = $i18next(error);
            });
            $scope.errors = errors;
            $timeout(function () { $scope.errors = null; }, 3000);
          });

}

      };
    }
  ])
  .controller('CollaboratorsCtrl', ['$scope','$modal', '$rootScope', '$i18next', 'User', 'Alert',
    function ($scope, $modal, $rootScope, $i18next, User, Alert) {
      Alert.init($rootScope);
      var currentModal = null;

      User
        .collaborators()
        .then(function (collaborators) {
  		    collaborators = _.uniq(collaborators, false, function (o) { if (o.user) { return o.user._id } else { return o.invite_email; } });
          $scope.collaborators = collaborators;
        })
        .catch(Alert.danger);

      $scope.delete = function (index) {
        if (!confirm($i18next('account.confirmCollaboratorDelete'))) {
          return;
        }

        var user = $scope.collaborators[index];
        User
          .removeFromAllProjects(user._id)
          .then(function () {
            $scope.collaborators.splice(index, 1);
          })
          .catch(Alert.danger);
      };

      $scope.view = function (index) {
        var user = $scope.collaborators[index];

        User
          .assignedNodes(user._id)
          .then(function (nodes) {
            $scope.assignedNodes = nodes;

            currentModal = $modal.open({
              templateUrl: 'assignedModal.html',
              size: 'sm',
              scope: $scope
            });
          })
          .catch(Alert.danger);
      };

      $scope.cancel = function () {
        currentModal.dismiss('cancel');
      };
    }
  ])
  .controller('UserInviteController', ['$scope', '$location', 'User', 'Analytics', 'Alert', '$i18next',
    function ($scope, $location, User, Analytics, Alert, $i18next) {
      Analytics.pageTrack('/referral');
      Alert.init($scope);
      $scope.referral = {};

      User
        .me()
        .then(function (user) {
          $scope.user = user;

          // options for the share button of gapi
          $scope.options = {
            contenturl: 'http://planhammer.io',
            contentdeeplinkid: '/pages',
            clientid: '957065445007.apps.googleusercontent.com',
            cookiepolicy: 'single_host_origin',
            prefilltext: generateUniqueUrl($location),
            calltoactionlabel: 'CREATE',
            calltoactionurl: '',
            calltoactiondeeplinkid: '/pages/create',
            requestvisibleactions: 'http://schemas.google.com/AddActivity'
          };
        })
        .catch(function (error) {
          $location.url('/signin');
        });

      // configure share button via gapi
      gapi.interactivepost.render('sharePost', $scope.options);

      function generateUniqueUrl($location) {
        return 'http://' + $location.host() + '/signup/' + $scope.user._id;
      }

      function shareToLinkedIn(referral) {
        var userid = $scope.user._id;
        var currentDomain = $location.host();
        var uniqueUrl = generateUniqueUrl($location);
        IN.API.Raw('/people/~/shares?format=json')
          .method('POST')
          .body(JSON.stringify({
            content: {
              'submitted-url': 'http://planhammer.io',
              'title': 'Plan Hammer',
              'description': 'Plan Hammer'
            },
            visibility: {
              code: 'anyone'
            },
            comment: referral.linkedInMessage + ' ' + uniqueUrl
          }))
          .result(function (result) {
            $scope.$apply(function () {
              Alert.success('Invite sent successfully');
            });
          })
          .error(function (error) {
            $scope.$apply(function() {
              Alert.danger(error);
            });
          });
      }

      $scope.shareInvitationToLinkedIn = function (referral, referralLinkedInForm) {
        if (!referralLinkedInForm.$valid) {
          return;
        }

        IN.User.authorize(function (result) {
          shareToLinkedIn(referral);
        }, function () {
        });
      };

      $scope.invite = function (referral, referralForm) {
        if (!referralForm.$valid) {
          return;
        }

        var data = {
          email: referral.email,
          message: referral.message
        };

        User
          .invite(data)
          .then(function () {
            Alert.success($i18next('referral.inviteSentSuccessfully'));
          }
          ,function (error) {
            Alert.danger($i18next(error));
          });
      };
    }
  ])
  .controller('AdminUserListController', ['$scope', '$http',
    function ($scope, $http) {
      $scope.users = [];

      $http.post('/api/admin/users', {})
        .success(function (data) {
          $scope.users = data.users;
        })
        .error(function (data) {
          $scope.error = data.message;
        });
    }
  ])
  .controller('AdminUserShowController', ['$scope', '$http', '$stateParams',
    function ($scope, $http, $stateParams) {
      $scope.user = [];

      $http.post('/api/admin/user/show', { username: $stateParams.username })
        .success(function (data) {
          $scope.user = data.user;
        })
        .error(function (data) {
          $scope.error = data.message;
        });
    }
  ])
  .controller('UserResetController', ['$scope', '$rootScope', 'User', 'Alert', '$i18next',
    function ($scope, $rootScope, User, Alert, $i18next) {
      Alert.init($scope);
      $rootScope.body_class = 'reset';

      $scope.reset = function (email) {
        User
          .resetLink(email)
          .then(function (data) {
			$i18next.options.lng = data.language || 'en';
            Alert.success($i18next('reset.linkSent'));
          })
          .catch(Alert.danger);
      };
    }
  ])
  .controller('UserResetConfirmController', ['$scope', '$rootScope', '$stateParams', 'User', 'Alert', '$timeout', '$state',
    function ($scope, $rootScope, $stateParams, User, Alert, $timeout, $state) {
      Alert.init($scope);
      $rootScope.body_class = 'reset';

User
.isTokenValid($stateParams.token)
.then(function(data){
  if (!data.isValid) {
    Alert.danger('reset.invalidToken');
	$timeout(function () { $state.go('not_authorized.signin'); }, 3000);
  }
})
.catch(Alert.danger);

      $scope.reset = function (pass1, pass2) {
        if (pass1 != pass2) {
          $scope.message = {
            type: 'warning',
            text: 'reset.passwordsNotMatch',
          };
          return;
        }

        User
          .reset($stateParams.token, pass1)
          .then(function () {
            Alert.success('reset.successfulReset');
			$timeout(function () { $state.go('not_authorized.signin'); }, 3000);
          })
          .catch(Alert.danger);
      };
    }
  ]);
