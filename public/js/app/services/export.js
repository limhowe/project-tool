'use strict';

angular.module('App.services')
  .service('Export', function ($http, $location, $window) {
    var self = this;

    self.export_handler = function (url, data, export_type) {
      $http.post(url, data)
        .success(function (data) {
          /*var el = $('#export-' + export_type);
          el.attr('href', data.path)[0].click();*/
          $window.location.href = data.path;
        })
        .error(function (data) {
          if (data.type ==='payment') {
            $location.url('/account/payments');
          }
        });
    };

    self.simple = function (export_type, project, tree) {
      var url = '/api/project/export/' + export_type + '/simple';
      var data = {
        project_id: project.id
      };

      if (export_type === 'raci') {
        data.raci = tree;
      } else if (export_type === 'risk-csv') {
        data.risks = tree;
      } else {
        data.tree = tree;
      }

      self.export_handler(url, data, export_type);
    };

    self.detailed = function (export_type, project, html_doc) {
      var url = '/api/project/export/' + export_type + '/detailed';
      var data = {
        project_id: project.id,
        html_doc: html_doc
      };

      self.export_handler(url, data, export_type);
    };

    /**
     * Export project tasks as CSV.
     * @param {String} projectId The ID of project to export.
     */
    self.exportProject = function (projectId, callback) {
      
	  //self.export_handler('/api/project/export/csv/tasks', {
      //  project_id: projectId
      //}, 'csv');
	  
	  var url = '/api/project/export/csv/tasks';
	  var data = {project_id: projectId};
	  
      $http.post(url, data)
        .success(function (data) {
          /*var el = $('#export-' + export_type);
          el.attr('href', data.path)[0].click();*/
		  
		  if (callback) {
			callback();
		  }
		  
          $window.location.href = data.path;
        })
        .error(function (data) {
          if (data.type ==='payment') {
            $location.url('/account/payments');
          }
        });

    };
  });
