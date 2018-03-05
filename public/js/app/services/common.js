(function() {
  'use strict';

  /**
   * Service for common functions shared across multiple controllers.
   */
  angular
    .module('App.services')
    .service('commonService', commonService);

  commonService.$inject = [];

  function commonService() {
    this.manageUsers = manageUsers;
    this.populateRisks = populateRisks;

    /**
     * Retrieve completed User objects with avatars for assigned users.
     * @param {Node} task
     * @param {Array} users An array of users for current project.
     */
    function manageUsers(task, users) {
      if (!task.assigned_users) {
        task.assigned_users = [];
      }

      task._assigned_users = [];
      _.each(task.assigned_users, function (assignedUser) {
        _.each(users, function (user) {
          if ((user.invite_email && assignedUser.invite_email && user.invite_email == assignedUser.invite_email) ||
            (!user.invite_email && !assignedUser.invite_email && user.user && (user.user._id == assignedUser.user || user.user._id == assignedUser.user._id))) {
            task._assigned_users.push(user);
          }
        });
      });

      // Generate avatars for users assigned to the given task.
      task.avatars = [];

      if (!task._assigned_users) {
        return;
      }

      _.each(task._assigned_users, function (user) {
        user = user.user ? user.user : user;

        var firstName = user.name ? user.name.first : null;
        if (user.avatar && user.avatar != "false") {
          task.avatars.push({
            imgUrl: user.avatar + '?' + (new Date).getTime(),
            email: user.email,
            name_first: firstName
          });
        } else if (user.invite_email) {
          task.avatars.push({
            placeholder: true,
            email: user.invite_email + ' (waiting for registration)'
          });
        } else if (user.email) {
          task.avatars.push({
            placeholder: true,
            email: user.email,
            name_first: firstName
          });
        } else if (user.avatar == "false") {
          task.avatars.push({
            initials: user.name.first.charAt(0) + ' ' + user.name.last.charAt(0),
            email: user.email,
            name_first: firstName
          });
        }
      });
    }

    /**
     * Populate Node objects with Risks.
     * @param {Node} node
     * @param {Array} risks
     */
    function populateRisks(node, risks) {
      node.risks = [];
      _.each(risks, function (risk) {
        if (!risk.node) {
          return;
        }

        _.each(risk.node, function (_node) {
          if (node._id == _node._id) {
            risk.score = risk.probability * risk.impact;
            node.risks.push(risk);
          }
        });
      });
    }
  }
})();
