'use strict';

angular.module('App.factories', [])
  .factory('TempNode', ['$http', function($http) {

  	function TempNode(projectId, parentId) {
  		var node = { 
  			_id: 'temp' + Date.now(),
  			_project: projectId,
  			task_id: parentId,
  			title: 'new task'
  		};

  		this.setData(node);
  	}

  	TempNode.prototype = {
  		setData: function(node) {
  			angular.extend(this, node);
  		}
  	}

  	return TempNode;
  }]);