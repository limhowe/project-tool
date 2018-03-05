'use strict';

angular.module('App.services')
  .service('User', function($rootScope, $cookieStore, $http, $q) {
    var self = this;
    var currentUser = null;

    function changeUser(user) {
      _.extend(currentUser, user);
    };

    self.auth = function (user) {
      $cookieStore.put('user', user);
    };

    self.isLogged = function () {
      return !angular.isUndefined($cookieStore.get('user'));
    };

    self.clean = function () {
      $cookieStore.remove('user');
    };

    self.get = function (name) {
      var user = $cookieStore.get('user');
      return (!_.isUndefined(user)) ? user[name] : null;
    };

    self.getById =  function (userId) {
      var deffered = $q.defer();

      $http.post('/api/user/get_by_id', {userId: userId})
        .success(function(data) {
          deffered.resolve(data);
        })
        .error(function(data) {
          deffered.reject(data);
        });

      return deffered.promise;
    };

    self.signin = function (user) {
      var deffered = $q.defer();

      $http.post('/api/signin', user)
        .success(function(data) {
          self.auth(data.user);
          deffered.resolve(data.user, data.redirect);
        })
        .error(function(data) {
          self.clean();
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.me = function () {
      var deffered = $q.defer();

      $http.get('/api/user/me')
        .success(function(data) {
          deffered.resolve(data);
        })
        .error(function(data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.loggedin =function () {
      var deffered = $q.defer();

      $http.post('/api/loggedin', {})
        .success(function(data) {
          deffered.resolve(data.user);
        })
        .error(function(data) {
          self.clean();
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.signup = function (data) {
      var deffered = $q.defer();

      $http.post('/api/signup', data)
        .success(function(data, status, headers, config) {
          self.auth(data.user);
          deffered.resolve(data.user);
        })
        .error(function(data) {
          self.clean();
          deffered.reject(data);
        });

      return deffered.promise;
    };

    self.confirm = function (code) {
      var deffered = $q.defer();

      $http.post('/api/user/confirm', { code: code })
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.signout = function () {
      var deffered = $q.defer();

      $http.post('/api/signout', {changedProjects: $rootScope.changedProjects, projectCreated: $rootScope.projectCreated})
        .success(function(data) {
          self.clean();
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      $rootScope.changedProjects = [];
      $rootScope.projectCreated = false;

      return deffered.promise;
    };

    self.update = function (user) {
      var deffered = $q.defer();

      $http.post('/api/user/update', user)
        .success(function(data) {
          self.auth(data.user);
          deffered.resolve(data.user);
        })
        .error(function(data) {
          var msg = data.message;

          if (msg && !_.isArray(msg)) msg = [msg];

          self.clean();
          deffered.reject(msg);
        });

      return deffered.promise;
    };

    /**
     * Add a coupon to user.
     * @param {String} couponCode
     * @return {Promise}
     */
    self.addCoupon = function (couponCode) {
      var defered = $q.defer();

      $http
        .post('/api/user/addCoupon', { code: couponCode })
        .success(defered.resolve)
        .error(function (error) {
          defered.reject(error.message);
        });

      return defered.promise;
    }

    self.invite = function (data_send) {
      var deffered = $q.defer();

      $http.post('/api/user/invite', data_send)
        .then(function() {
          deffered.resolve();
        }
        ,function(response) {
          deffered.reject(response.data.message);
        });

      return deffered.promise;
    };

    self.deactivate = function () {
      var deffered = $q.defer();

      $http.post('/api/user/deactivate', {})
        .success(function() {
          deffered.resolve();
        })
        .error(function(data) {
          self.clean();
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.collaborators = function () {
      var deffered = $q.defer();
      var url = '/api/user/collaborators';

      $http.get(url)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.removeFromAllProjects = function (userId) {
      var deffered = $q.defer();
      $http
        .delete('/api/user/' + userId + '/from_project/')
        .success(function () {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.removeFromProject = function (userId, projectId) {
      var deffered = $q.defer();
      $http
        .delete('/api/user/' + userId + '/remove_from_project/' + projectId)
        .success(function () {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.assignedNodes = function (userId, projectId) {
      var deffered = $q.defer();
      $http
        .get('/api/user/' + userId + '/project/' + projectId +  '/nodes')
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.resetLink = function (email) {
      var deffered = $q.defer()
      var url = '/user/reset';
      var payload = { email: email };

      $http.post(url, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.isTokenValid = function (token) {
      var deffered = $q.defer()
      var payload = {};

      $http.get('/user/reset/' + token, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.reset = function (token, password) {
      var deffered = $q.defer()
      var payload = {
        password: password
      };

      $http.post('/user/reset/' + token, payload)
        .then(function (response) {
          deffered.resolve(response.data);
        },
        function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.search = function (q) {
      return $http.post('/api/user/search', { q: q }).then(function (response) {
        return response.data;
      });
    };

    self.searchByEmail = function (email) {
      return $http.post('/api/user/searchByEmail', { q: email }).then(function (response) {
        return response.data;
      });
    };

    self.searchByUsername = function (username) {
      return $http.post('/api/user/searchByUsername', { q: username }).then(function (response) {
        return response.data;
      });
    };

    self.assign = function (email, node_id) {
      var deffered = $q.defer();
      var payload = {
        email: email,
        node: node_id
      };

      $http.post('/api/user/assign/', payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.reject = function (email, nodeId) {
      var deffered = $q.defer();
      var payload = {
        email: email,
        node: nodeId
      };

      $http.post('/api/user/unassign/', payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.tasksAssigned = function () {
      var deffered = $q.defer();
      var url = '/api/user/assigned_tasks/';

      $http.get(url)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.getImage = function (user_id) {
      var deffered = $q.defer();
      var image_url = '/api/user/' + user_id + '/image?buffer=true';

      $http.get(image_url)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data);
        });

      return deffered.promise;
    };

    self.setImage = function (user_id, form_data) {
      var deffered = $q.defer();
      var url = '/api/user/' + user_id + '/image';
      var options = {
        withCredentials: true,
        headers: {'Content-Type': undefined },
        transformRequest: angular.identity
      };

      $http.post(url, form_data, options)
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.invitedEmails = function () {
      var deffered = $q.defer();

      $http.get('/api/user/invited_emails')
        .success(function(data) {
          deffered.resolve(data);
        })
        .error(function(data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.hasDemo = function() {
      var deffered = $q.defer();
      var url = '/api/user/has_demo';

      $http.get(url)
	    .then(
        function (response) {
          deffered.resolve(response.data.has_demo);
        },
        function () {
          deffered.reject();
        });

      return deffered.promise;
    }

    self.isPassword = function(password) {
      var deffered = $q.defer();
      var url = '/api/user/is_password/'+ password;

      $http.get(url)
	    .then(
        function (response) {
          deffered.resolve(response.data.is_password);
        },
        function () {
          deffered.reject();
        });

      return deffered.promise;
    }

    //temp solution for autostarting tour on first login
    self.see_demo = function(user_email) {
      var deffered = $q.defer();
      var url = '/api/user/'+user_email+'/see_demo';

      $http.get(url)
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    }

    self.setLastActivity = function(project, activity) {
      var deffered = $q.defer();
      var url = '/api/user/last_activity';

      $http.put(url, {project: project, activity: activity})
      .success(function (data) {
        deffered.resolve();
      })
      .error(function (data) {
        deffered.reject(data.message);
      });

      return deffered.promise;
    }

    self.getLastActivity = function(project) {
      var deffered = $q.defer();
      var url = '/api/user/last_activity/' + project;

      $http.get(url)
      .then(
        function (response) {
          deffered.resolve(response.data.last_activity);
        },
        function () {
          deffered.reject();
        }
      );

      return deffered.promise;
    }

  });
