'use strict';

angular.module('App.controllers').controller('ActivityFeedController', ['$scope', '$rootScope', '$http', '$stateParams', '$timeout', 'User', 'Project', 'Node', 'DateFormat', 'socketService',
  function ($scope, $rootScope, $http, $stateParams, $timeout, User, Project, Node, DateFormat, socketService) {

    $scope.showLoader = false;
    $scope.activities = [];
    $scope.currentPage = 1;
    $scope.pageCount = 1;

    $scope.getActivityList = function (page) {

      if (!$stateParams.id) {
        return;
      }
      $scope.dateFormat = DateFormat.getFormat($scope.project ? $scope.project.dateformat : 'en-US').str;
      $scope.dateFormat = $scope.dateFormat + ' HH:mm:ss';

      $scope.showLoader = true;
      $scope.activities = [];
      $scope.currentPage = page;
      Project.getActivityList($stateParams.id, page).then(function (result) {
        $scope.pageCount = result.pageCount;
        $scope.activities = result.docs;

        $scope.showLoader = false;
        $rootScope.newFeedActivity = false;

        // if ($scope.activities.length>0) {
        //   User.setLastActivity($stateParams.id, $scope.activities[0]._id);
        // }
      })
      .catch(function (error) {

      });
    };

    $scope.loadNextPage = function () {
      if ($scope.currentPage>=$scope.pageCount) return;
      $scope.getActivityList($scope.currentPage+1);
    }

    $scope.loadPreviousPage = function () {
      if ($scope.currentPage<=1) return;
      $scope.getActivityList($scope.currentPage-1);
    }

    $scope.selectNode = function (nodeId) {
      Node
        .get(nodeId)
        .then(function (node) {
          $rootScope.selectNode(node);
        });
    }

    $scope.$on('showActivityFeed', onShowActivityFeed);

    /**
     * Show the feed upon receiving 'showActivityFeed' event.
     */
    function onShowActivityFeed() {
      $scope.getActivityList(1);
    }

    $scope.$on('project_fetched', onProjectFetched);

    function onProjectFetched() {
      // Establish a socket connection.
      var socket = socketService.getSocket($rootScope.project._id);

      // Socket.io event handlers.
      socket.on('activity.add', function(activity) {
        $timeout(function(){
          if ($rootScope.isFeedVisible && $scope.currentPage==1) {
            $scope.activities.unshift(activity);
            //$scope.getActivityList();
            User.setLastActivity($stateParams.id, activity._id);
            $rootScope.newFeedActivity = false;
          } else {
            $rootScope.newFeedActivity = true;
          }
        }, 0);
      });
    }

  }
]);
