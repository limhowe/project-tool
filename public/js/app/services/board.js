'use strict';

angular.module('App.services')
  .service('Board', function ($http, $q) {
    var self = this;

    self.all = function (projectId) {
      var deffered = $q.defer();
      $http
        .get('/api/project/' + projectId + '/board')
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.create = function (name, projectId) {
      var deffered = $q.defer();
      $http
        .post('/api/board', {
          name: name,
          project: projectId
        })
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.remove = function (boardId) {
      var deffered = $q.defer();
      $http
        .delete('/api/board/' + boardId)
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.update = function (projectId, boardId, payload) {
      var deffered = $q.defer();
      $http
        .put('/api/project/' + projectId + '/board/' + boardId, payload)
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Create new list.
     * @param {String} name The new list name.
     * @param {String} boardId The parent board ID.
     */
    self.create_list = function (name, boardId) {
      var deffered = $q.defer();
      $http
        .post('/api/board/' + boardId + '/list', {
          name: name
        })
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Remove list.
     * @param {String} listId
     */
    self.remove_list = function (listId) {
      var deffered = $q.defer();
      $http
        .delete('/api/list/' + listId)
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Update list.
     * @param {String} listId
     * @param {String} boardId
     * @param {Object} payload
     */
    self.update_list = function (listId, boardId, payload) {
      var deffered = $q.defer();
      $http
        .put('/api/board/' + boardId + '/list/' + listId, payload)
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Add task to list.
     * @param {String} taskId
     * @param {String} listId
     * @param {Number} position
     */
    self.add_to_list = function (taskId, listId, position) {
      var deffered = $q.defer();
      $http
        .post('/api/list/' + listId + '/task', {
          node: taskId,
          position: position
        })
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.update_task = function (list_id, node_id, payload) {
      var deffered = $q.defer();
      var url = '/api/list/' + list_id + '/task/' + node_id;

      $http.put(url, payload)
      .success(deffered.resolve)
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    };

    /**
     * Remove task from list.
     * @param {String} taskId
     * @param {String} listId
     */
    self.remove_task = function (taskId, listId) {
      var deffered = $q.defer();
      $http
        .delete('/api/list/' + listId + '/task/' + taskId)
        .success(deffered.resolve)
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.get = function (board_id) {
      var deffered = $q.defer();
      var url = '/api/board/' + board_id;

      $http.get(url)
      .success(deffered.resolve)
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    };

    self.get_lists = function (board_id) {
      var deffered = $q.defer();
      var url = '/api/board/' + board_id + '/lists';

      $http.get(url)
      .success(deffered.resolve)
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    };

    self.move_task_between_lists = function (old_list_id, new_list_id, node_id, tasks) {
      var deffered = $q.defer();
      var url = '/api/old_list/' + old_list_id + '/new_list/' + new_list_id;
      $http.put(url, { node_id: node_id, tasks: tasks })
      .success(deffered.resolve)
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    };


    self.change_task_position = function (list_id, task_id,position) {
      var deffered = $q.defer();
      var url = '/api/change_task_position/list/' + list_id + '/task/'+task_id+'/position/'+position;

      $http.put(url)
      .success(deffered.resolve)
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    };



  });
