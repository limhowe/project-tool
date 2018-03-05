'use strict';

angular.module('App.controllers')
.controller('UserCardController', ['$scope', '$location', '$filter', 'User', 'Config', 'Payment', '$i18next', '$state',
  function ($scope, $location, $filter, User, Config, Payment, $i18next, $state) {
    $scope.showUpdateForm = false;
    $scope.card = {};

    Payment.getPlan()
    .then(function (subscription) {
      if (! subscription) return;

      $scope.currentPlan = subscription.plan;
      $scope.currentPlanExpiration = $filter('date')(subscription.ending_at, 'MMMM d');
      $scope.currentPlanAmount = $filter('currency')(subscription.plan.stripe.amount / 100);
      $scope.currentCard = subscription.card;
    });

    Payment.initPlugin();

    $scope.updateCard = function(card, cardForm) {
      Stripe.setPublishableKey(Config.stripe.api);

      var expdate = card.expdate.split('/');
      var card_data = {
        number: card.number,
        cvc: card.cvc,
        exp_month: expdate[0].trim(),
        exp_year: expdate[1].trim()
      };

      Stripe.createToken(card_data, function (status, response) {
        if (response.error) {
          $scope.$apply(function () {
            $scope.error = response.error.message;
          })
          return;
        }

        Payment.updateCard(response.id)
        .then(function () {
          $scope.error = null;
          $scope.success = $i18next('account.creditCardAdded');
          $scope.card = {};
        })
        .catch(function (error) {
          $scope.error = error;
        });
      });
    };

    $scope.deactivateAccount = function () {
      if (window.confirm($i18next('account.confirmAccountDelete'))) {
        User.deactivate()
        .then(function () {
          User.clean();
          User.signout()
          .then(function () {
            $state.go('not_authorized.signin');
          });
        });
      }
    };

    /**
     * Add a new Stripe coupon.
     */
    $scope.addCoupon = function (couponForm) {
      if (!couponForm.$valid) {
        return;
      }

      User
        .addCoupon($scope.couponCode)
        .then(function () {
          $scope.errorCoupon = null;
          $scope.successCoupon = $i18next('account.couponAdded');
          $scope.couponCode = '';
        })
        .catch(function (error) {
          $scope.errorCoupon = error;
        });
    };
  }
]);
