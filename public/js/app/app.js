'use strict';

// Declare app level module which depends on filters, and services
var dependencies = [
  'App.controllers',
  'App.filters',
  'App.factories',
  'App.services',
  'App.directives',
  'ngCookies',
  'ngRoute',
  'ngAnimate',
  'ui.router',
  'ui.bootstrap',
  'angulartics',
  'angulartics.google.analytics',
  'angularMoment',
  "kendo.directives",
  'ui.tree',
  'dndLists',
  'lk-google-picker',
  'ngSanitize',
  'jm.i18next',
];

var App = angular.module('App', dependencies)
.config(function ($routeProvider, $locationProvider, $httpProvider, $stateProvider, $urlRouterProvider, $analyticsProvider) {
  //initialize get if not there
  if (!$httpProvider.defaults.headers.get) {
      $httpProvider.defaults.headers.get = {};
  }

  //disable IE ajax request caching
  $httpProvider.defaults.headers.get['If-Modified-Since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
  // extra
  $httpProvider.defaults.headers.get['Cache-Control'] = 'no-cache';
  $httpProvider.defaults.headers.get['Pragma'] = 'no-cache';



  $analyticsProvider.virtualPageviews(false);
  $locationProvider.html5Mode(true);

  /**
   * Resolve the login status.
   */
  var checkLoggedin = ['$q', '$http', '$state', 'User', function ($q, $http, $state, User) {
    var deferred = $q.defer();
    $http
      .post('/api/loggedin')
      .success(function (res) {
        if (res.success) {
          deferred.resolve();
          return;
        }

        User.clean();
        $state.go('not_authorized.signin');
        deferred.reject();
      });
    return deferred.promise;
  }];

  /**
   * Resolve payment status.
   */
  var checkPaymentStatus = ['$rootScope', '$q', '$http', '$state', function ($rootScope, $q, $http, $state) {
    var deferred = $q.defer();
    if (!_.isUndefined($rootScope.shouldPay)) {
      check();
    } else {
      $http
        .get('/api/payment-status')
        .success(function (res) {
          $rootScope.shouldPay = res.shouldPay;
          check();
        })
        .error(function () {
          deferred.reject();
        });
    }
    return deferred.promise;

    function check() {
      if (!$rootScope.shouldPay) {
        deferred.resolve();
      } else {
        deferred.reject();
        $state.go('default.account', {
          tab: 'payments',
        });
      }
    }
  }];

  App.factory('$exceptionHandler', ['$injector', function ($injector) {
      function log(exception, cause) {
        Airbrake.push({
          error : {
            message : exception.toString(),
            stack : exception.stack
          },
          params : {
            user : $user,
            history : $history
          }
        });
      }

      return ( log );
    }]
  );

  App.config(['lkGoogleSettingsProvider', function (lkGoogleSettingsProvider) {
    lkGoogleSettingsProvider.configure({
      developerKey   : 'AIzaSyBm9MfyKfeVLkwCzKR7Szcz037PPs8tHIw',
      clientId : '957065445007-46ak8t91c9ihv6ae40t23fdt8bjoie3f.apps.googleusercontent.com',
      scopes   : ['https://www.googleapis.com/auth/drive.readonly'],
    });
    lkGoogleSettingsProvider.setViews([
      'DocsUploadView().setIncludeFolders(true)',
      'DocsView().setStarred(true)'
    ]);
  }]);

  // Add an interceptor for AJAX errors
  $httpProvider.responseInterceptors.push(['$q', '$location', function($q, $location) {
    return function(promise) {
      return promise.then(
        function(response) {
          return response;
        },
        function(response) {
          if (response.status === 401) {
            $location.url('/signin');
          }
          return $q.reject(response);
        }
      );
    }
  }]);

  $urlRouterProvider.otherwise('/');

  // redirects
  $urlRouterProvider.when('/projects', '/projects/created');
  $urlRouterProvider.when('/', '/projects/created');

  $stateProvider
    .state('default', {
      abstract: true,
      url: '',
      templateUrl: 'view/layout/authorized',
      resolve: {
        loggedin: checkLoggedin
      }
    })
    .state('default.home', {
      url: '/',
      templateUrl: 'view/main/home'
    })
    .state('default.plans', {
      url: '/plans',
      templateUrl: '/view/payment/plans',
      controller: 'PlansController'
    })
    .state('default.plan_subscribe', {
      url: '/plan/:plan_id/subscribe',
      templateUrl: '/view/payment/subscribe',
      controller: 'PaymentController'
    })
    .state('default.projects', {
      url: '/projects/:type',
      templateUrl: '/view/project/project_list',
      controller: 'ProjectListController',
      controllerAs: 'vm',
      resolve: {
        isPaid: checkPaymentStatus
      }
    })
   .state('default.project', {
      abstract: true,
      url: '/project/:id/show',
      templateUrl: 'view/project/show',
      controller: 'ProjectShowCtrl',
      controllerAs: 'vm',
      resolve: {
        isPaid: checkPaymentStatus
      }
    })
    .state('default.project.list', {
      reloadOnSearch : false,
      url: '?task',
      templateUrl: '/view/project/list_view_t',
      controller: 'listviewController',
      controllerAs: 'vm',
    })
    .state('default.project.manage', {
      url: '/manage',
      templateUrl: '/view/project/manage',
      controller: 'ProjectManageController',
      controllerAs: 'vm',
    })
    .state('default.project.gantt', {
      url: '/gantt',
      templateUrl: '/view/project/gantt',
      controller: 'ProjectGanttController'
    })
    .state('default.project.agile', {
      url: '/agile?board&task',
      templateUrl: '/view/project/agile',
      controller: 'AgileController',
      controllerAs: 'vm',
      reloadOnSearch: false,
    })
    .state('default.project.detailed', {
      url: '/detailed',
      templateUrl: '/view/project/detailed_view',
    })
    .state('default.project.raci', {
      url: '/raci',
      templateUrl: '/view/project/raci',
    })
    .state('default.project.risk', {
      url: '/risk',
      templateUrl: '/view/project/risk',
      controller: 'RiskViewController',
      controllerAs: 'vm',
    })
    .state('default.project.quality', {
      url: '/quality',
      controller: 'qualityController',
      templateUrl: '/view/project/quality',
    })
    .state('default.project_create', {
      url: '/project/create',
      templateUrl: '/view/project/create',
      controller: 'ProjectCreateController',
      controllerAs: 'vm',
    })
    .state('default.feedback', {
      url: '/feedback',
      templateUrl: '/view/main/feedback',
      controller: 'StaticController',
      data: {
        pageName: 'feedback'
      }
    })
    .state('default.account', {
      url: '/account/:tab',
      templateUrl: '/view/user/account',
      controller: 'AccountEditController',
      params: {
        'redirect': null
      }
    })
    .state('default.settings', {
      url: '/settings',
      templateUrl: '/view/user/settings'
    })
    .state('default.referral', {
      url: '/referral',
      templateUrl: '/view/user/referral',
      controller: 'UserInviteController'
    })
    .state('not_authorized', {
      abstract: true,
      url: '',
      templateUrl: 'view/layout/not_authorized'
    })
    .state('not_authorized.signin', {
      url: '/signin',
      templateUrl: 'view/user/signin',
      controller: 'SigninController',
      controllerAs: 'vm',
    })
    .state('not_authorized.signup', {
      url: '/signup?lang',
      templateUrl: 'view/user/signup',
      controller: 'SignupController',
      controllerAs: 'vm',
    })
    .state('not_authorized.invite', {
      url: '/signup/:type/:user_id/:email',
      templateUrl: 'view/user/signup',
      controller: 'SignupController'
    })
    .state('not_authorized.confirmation', {
      url: '/confirm/:code/:email',
      templateUrl: 'view/user/confirmation',
      controller: 'ConfirmationController'
    })
    .state('not_authorized.reset', {
      url: '/reset',
      templateUrl: 'view/user/reset',
      controller: 'UserResetController'
    })
    .state('not_authorized.reset_confirm', {
      url: '/reset/:token',
      templateUrl: 'view/user/reset_confirm',
      controller: 'UserResetConfirmController'
    })
    .state('admin', {
      abstract: true,
      url: '/admin',
      templateUrl: 'view/admin/layout/default',
      resolve: {
        loggedin: checkLoggedin
      }
    })
    .state('admin.home', {
      url: '',
      templateUrl: 'view/admin/main/home',
      role: ['admin']
    })
    .state('admin.users', {
      url: '/users',
      templateUrl: 'view/admin/user/list',
      role: ['admin'],
      controller: 'AdminUserListController'
    })
    .state('admin.user_show', {
      url: '/user/:username',
      templateUrl: 'view/admin/user/show',
      role: ['admin'],
      controller: 'AdminUserShowController'
    });
})
.config(['$i18nextProvider', i18nextConfig])
.run(['$rootScope', '$state', '$stateParams', '$window', '$http', 'Project', 'User', runApp]);

/**
 * Configure the i18next.
 */
function i18nextConfig($i18nextProvider) {
  $i18nextProvider.options = {
    lng: 'en',
    fallbackLng: false,
    resGetPath: 'locales/__lng__.json'
  };

  moment.locale('es', {
    longDateFormat: {
      LL: 'DD.MM.YYYY',
    },
    relativeTime : {
      future: "en %s",
      past:   "hace %s",
      s:  "segundos",
      m:  "un minuto",
      mm: "%d minutos",
      h:  "una hora",
      hh: "%d horas",
      d:  "un día",
      dd: "%d días",
      M:  "un mes",
      MM: "%d meses",
      y:  "un año",
      yy: "%d años"
    }
  });
}

function runApp($rootScope, $state, $stateParams, $window, $http, Project, User) {
  $rootScope.changedProjects = [];
  $rootScope.projectCreated = false;

  // Logout function is available in any pages
  $rootScope.logout = function () {
    $rootScope.changedProjects = [];
    User.clean();
    $http.post('/signout');
  };

  $rootScope.$state = $state;
  $rootScope.$stateParams = $stateParams;

  $rootScope.$on('$stateChangeStart', function (ev, to, toParams, from, fromParams) {
    if (to.role && (!User.isLogged() || !_.contains(to.role, User.get('role')))) {
      $window.location = (to.signin || '/signin');
    }
  });

  $rootScope.$on('$stateChangeSuccess', function (ev, to, toParams, from, fromParams) {
    if (toParams.id == null) {
      $rootScope.project = null;
    }

    $rootScope.isFeedVisible = false;

    if (toParams.id) {
      Project
        .getLastActivity(toParams.id)
        .then(function (projectActivity) {
          User
            .getLastActivity(toParams.id)
            .then(function (userActivity) {
              $rootScope.newFeedActivity = projectActivity != userActivity;
            });
        });
    }

  });
}
