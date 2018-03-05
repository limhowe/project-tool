'use strict';

angular.module('App.services')
  .service('Node', function($rootScope, $http, $q, Project) {

  var self = this;

  function rWalk(d, fn) {
    if (d._nodes && d._nodes.length) {
      d._nodes.forEach(function (d) {
        fn(d);
        if (d._nodes && d._nodes.length) {
          rWalk(d, fn);
        }
      });
    }
  }

  function findNode(id, root) {
    var task;
    rWalk(root, function (node) {
      if (node._id == id) {
        task = node;
      }
    });
    return task;
  }

  function recursiveWalk (root, fn) {
    function getMinStart(d) {
      if (d && d._nodes && d._nodes.length) {
        var minStart = new Date(d._nodes[0].start_date);
        d._nodes.forEach(function(node){
          if (new Date(node.start_date) < minStart || minStart == 0) {
            minStart = node.start_date;
          };
        })
      };
      return minStart;
    }

    function getMaxEnd(d) {
      if (d._nodes && d._nodes.length) {
        var maxEnd = new Date(d._nodes[0].end_date);
        d._nodes.forEach(function(node){
          if (new Date(node.end_date) > maxEnd || maxEnd == 0) {
            maxEnd = node.end_date;
          };
        })
      };
      return maxEnd;
    }

    function parentRec(node) {
      if (!node._parent || !node._parent._nodes) {
        return;
      }

      var parent = findNode(node._parent._id, root);
      if (!parent) {
        return;
      }

      parent.start_date = getMinStart(parent);
      parent.end_date = getMaxEnd(parent);
      parentRec(parent);
    }

    function rec(d) {
      d._nodes.forEach(function (_d) {
        if (_d._nodes && _d._nodes.length) {
          rec(_d);
        } else {
          parentRec(_d);
        }
      });
    }

    rec(root);
  }

    // Getting nodes list
    self.getList = function (project, completed) {
      var deffered = $q.defer();
      $http
        .post('/api/project/nodes', { project: project, completed: completed })
        .success(function (data) {
          data._nodes = data.nodes;
          recursiveWalk(data);
          deffered.resolve(data._nodes);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    function dhm(t) {
      var cd = 24 * 60 * 60 * 1000,
          ch = 60 * 60 * 1000,
          d = Math.floor(t / cd),
          h = Math.floor( (t - d * cd) / ch),
          m = Math.round( (t - d * cd - h * ch) / 60000),
          pad = function (n) {
            return n < 10 ? '0' + n : n;
          };

      if (m === 60) {
        h++;
        m = 0;
      }

      if (h === 24) {
        d++;
        h = 0;
      }

      if (d != 0) {
        return {
          type: 'days',
          value: d + 1
        };
      }

      if (d == 0 && pad(h) != '00') {
        return {
          type: 'hours',
          value: pad(h)
        };
      }

      if (d == 0 && pad(h) == '00' && pad(m) != '00') {
        return {
          type: 'minutes',
          value: pad(m)
        };
      }

      return {
        type: 'days',
        value: 0
      };
    }

    /**
     * Update node.
     * @param {String} nodeId
     * @param {Object} nodeData
     * @param {[type]} durationUpdate
     */
    self.update = function (nodeId, nodeData, durationUpdate) {
      var deffered = $q.defer();

      if (nodeData.end_date && nodeData.start_date && !durationUpdate) {
        nodeData.duration = dhm(new Date(nodeData.end_date) - new Date(nodeData.start_date));
      }

      var payload = {
        node_data: nodeData
      };

      $http
        .put('/api/project/node/' + nodeId, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    // Update parent for Node
    self.updateParent = function (nodeId, parentId) {
      var deffered = $q.defer();

      var data = {
        parent_id: parentId
      };

      $http
        .put('/api/project/node/' + nodeId + '/parent', data )
        .success(function (data) {
          deffered.resolve(data.node);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    /**
     * Clone current task
     * @param {String} nodeId
     */
    self.clone = function(nodeId,projectId,parentId) {
      var deffered = $q.defer();

      var data = {};
      if (parentId) {
        data.parent_id = parentId;
      }

      if (projectId) {
        data.project_id = projectId;
      }

      $http
        .post('/api/project/node/' + nodeId + '/clone',data)
        .success(function (data) {
          Project
            .addRaci({
              allowCollaborator: true,
              project: projectId,
              node: data.node._id,
              resource: $rootScope.user.email,
              role: 'accountable',
              type: 'raci_tab'
            })
            .then(function () {
              deffered.resolve(data.node);
            });
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    }

    /**
     * Create new task.
     * @param {String} projectId
     * @param {String} parentId
     * @param {Object} nodeData
     */
    self.add = function (projectId, parentId, nodeData) {
      var deffered = $q.defer();
      $http
        .post('/api/project/node/' + ((parentId) ? 'add' : 'add_root'), {
          project_id: projectId,
          parent_id: parentId,
          node_data: nodeData
        })
        .success(function (data) {
          Project
            .addRaci({
              allowCollaborator: true,
              project: projectId,
              node: data.node._id,
              resource: $rootScope.user.email,
              role: 'accountable',
              type: 'raci_tab'
            })
            .then(function () {
              deffered.resolve(data.node);
            });
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    /**
     * Delete node.
     * @param  {String} nodeId
     */
    self.delete = function (nodeId) {
      var deffered = $q.defer();
      $http
        .delete('/api/project/node/' + nodeId)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    // Get node full info
    self.get = function (nodeId) {
      var deffered = $q.defer();
      $http
        .get('/api/project/node/' + nodeId)
        .success(function (data) {
          deffered.resolve(data.node);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });
      return deffered.promise;
    };

    self.addDependency = function (predecessorId, successorId, type) {
      var deffered = $q.defer();
      var payload = {
        id: predecessorId,
        type: type,
      };

      $http
        .post('/api/project/node/' + successorId + '/dependency', payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.deleteDependency = function (predecessorId, successorId, type) {
      var deffered = $q.defer();

      $http
        .delete('/api/project/node/' + predecessorId + '/dependency/' + successorId + '/' + type)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.addQuality = function (nodeId, payload) {
      var deffered = $q.defer();

      $http
        .post('/api/project/node/' + nodeId + '/quality', payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.updateQualityText = function (nodeId, qualityId, newText) {
      var deffered = $q.defer();

      var payload = {
        text: newText
      };

      $http
        .put('/api/project/node/' + nodeId + '/quality/' + qualityId, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.updateQuality = function (nodeId, qualityId, completed) {
      var deffered = $q.defer();

      var payload = {
        completed: completed
      };

      $http
        .put('/api/project/node/' + nodeId + '/quality/' + qualityId, payload)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.deleteQuality = function (nodeId, qualityId) {
      var deffered = $q.defer();

      $http
        .delete('/api/project/node/' + nodeId + '/quality/' + qualityId)
        .success(function (data) {
          deffered.resolve(data);
        })
        .error(function (data) {
          deffered.reject(data.message);
        });

      return deffered.promise;
    };

    self.nodesByTitle = function (title, projectId) {
      var payload = {
        q: title,
        project_id: projectId
      };

      return $http
        .post('/api/project/node/searchByTitle', payload)
        .then(function (res) {
          return res.data;
        });
    };

    self.changePosition = function (id, position) {
      var deffered = $q.defer();
      var payload = {
        position: position
      };

      $http
        .post('/api/project/node/' + id + '/position', payload)
        .success(function (data) {
          deffered.resolve();
        })
        .error(function (error) {
          deffered.reject(error.message);
        });

      return deffered.promise;
    };

    self.addFile = function (nodeId, payload) {
      var deffered = $q.defer();

      $http
        .post('/api/project/node/' + nodeId + '/file', payload)
        .then(function(response){
		  deffered.resolve(response.data);
		}, function (error) {
          deffered.reject(error.message);
        });

      return deffered.promise;
    };

    /**
     * Upload a file and add it to the specified node.
     * @param {String} nodeId
     * @param {File} fileObj
     * @return {Promise}
     */
    self.uploadFile = function (nodeId, fileObj) {
      var defered = $q.defer();

      var formData = new FormData();
      formData.append('file', fileObj);

      $http
        .post('/api/project/node/' + nodeId + '/upload', formData, {
          transformRequest: angular.identity,
          headers: {
            'Content-Type': undefined
          }
        })
        .success(defered.resolve)
        .error(function (error) {
          defered.reject(error.message);
        });

      return defered.promise;
    };

    self.deleteFile = function (nodeId, fileId) {
      var deffered = $q.defer();

      $http.delete('/api/project/node/' + nodeId + '/file/' + fileId)
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });

      return deffered.promise;
    };

    self.getRaci = function (nodeId) {
      var deffered = $q.defer();
      $http
        .get('/api/project/node/' + nodeId + '/raci')
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

    self.ganttDateUpdate = function (nodeId, kendoEvent) {
      var deffered = $q.defer();
      $http
        .put('/api/project/node/' + nodeId + '/ganttUpdate', kendoEvent)
        .success(deffered.resolve)
        .error(function (error) {
          deffered.reject(error.message);
        });
      return deffered.promise;
    };

  });
