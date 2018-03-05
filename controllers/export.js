var isProjectOwner = Middlewares.secure.isProjectOwner;
var hasProjectAccess = Middlewares.secure.hasProjectAccess;
var export_handler = Helpers.export.handler;
var Api_Response = Middlewares.general.api_response;
var Project = Models.Project;
var Node = Models.Node;
var Raci = Models.Raci;
var amazon = Helpers.amazon;

app.get('/api/data/ms-project/:projectId', function (req, res, next) {
  var projectId = req.params.projectId;
  Project.findById(projectId, function (error, project) {
    amazon.get_file('projects', 'ms', projectId, function (error, file) {
      res.set({
        'Content-Disposition': 'attachment; filename="' + project.name + '.mpp"'
      });
      res.send(file);
    });
  });
});

app.get('/api/data/:type/:name', function (req, res, next) {
  var project_id, file_type, filename;
  var type = req.params.type;
  var name = req.params.name;
  var path = APP_PATH + 'public/files/' + type + '/' + name;
  var match = name.match(/^(.+)_(simple|detailed|tasks)\.(.{3})$/);

  if (match && match.length === 4) {
    project_id = match[1];
    file_type = match[3];

    Project.findById(project_id, function (error, project) {
      filename = project.name;

      if (type === 'risk' || type === 'risk-csv') {
        filename += ' Risk Register';
      }
      if (type === 'raci') filename += ' RACI';

      if (type === 'pdf') {
        filename += ' ' + match[2];
        type = type + '-' + match[2];
      }

      amazon.get_file('projects', type, project_id, function (error, file) {
        filename += '.' + file_type;
        res.set({ 'Content-Disposition': 'attachment; filename="' + filename +'"' });
        res.send(file);
      });
    });
  } else {
    res.download(path);
  }
});

app.post('/api/project/export/pdf/simple', hasProjectAccess, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project_id;
  var tree = req.body.tree;

  export_handler('pdf', 'simple', project_id, tree, function(error, url) {
    if (error) return api_response(error);
    api_response(null, { path: '/api/data/pdf/' + project_id + '_simple.pdf' });
  });
});

app.post('/api/project/export/pdf/detailed', hasProjectAccess, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project_id;
  var html_doc = req.body.html_doc;

  export_handler('pdf', 'detailed', project_id, html_doc, function(error) {
    if (error) return api_response(error);

    api_response(null, { path: '/api/data/pdf/' + project_id + '_detailed.pdf' });
  });
});

app.post('/api/project/export/csv/tasks', hasProjectAccess, function (req, res, next) {
  var apiResponse = Api_Response(req, res, next);
  var projectId = req.body.project_id;

  Node
    .find({
      _project: projectId,
      _parent: null,
    })
    .populate({
      path: '_nodes',
      options: {
        sort: 'position'
      }
    })
    .populate({
      path: '_dependency.node',
      select: '_id title'
    })
    .sort('position')
    .exec(onFindSuccess);

  function onFindSuccess(error, nodes) {
    if (error) {
      return apiResponse(error);
    }

    populateTasks(nodes, '_nodes', '_dependency.node', '_parent', 1, function (error, tasks) {
      if (error) {
        return apiResponse(error);
      }

      export_handler('csv', 'tasks', projectId, tasks, function (error) {
        if (error) {
          return apiResponse(error);
        }

        apiResponse(null, {
          path: '/api/data/csv-task/' + projectId + '_tasks.csv'
        });
      });
    });
  }
});

function populateTasks(nodes, nodesPath, depPath, parentPath, level, callback) {
  nodesPath += '._nodes';
  parentPath = '_nodes.' + parentPath;
  depPath = '_nodes.' + depPath;

  var options = [
    {
      path: nodesPath,
      options: {
        sort: 'position',
      }
    },
    {
      path: parentPath,
    },
    {
      path: 'assigned_users.user'
    },
    {
      path: depPath,
      select: '_id title',
    }
  ];

  Node.populate(nodes, options, function (error, nodes) {
    if (error) {
      return callback(error);
    }

    if (level <= 10) {
      populateTasks(nodes, nodesPath, depPath, parentPath, level + 1, callback);
    } else {
      callback(null, nodes);
    }
  });
}

app.post('/api/project/export/csv/simple', hasProjectAccess, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project_id;
  var tree = req.body.tree;

  export_handler('csv', 'simple', project_id, tree, function (error) {
    if (error) {
      return api_response(error);
    }

    api_response(null, {
      path: '/api/data/csv/' + project_id + '_simple.csv'
    });
  });
});

/**
 * Generate and upload a CSV file to S3 bucket to export Raci data.
 */
app.post('/api/project/export/raci/simple', hasProjectAccess, function(req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project_id;

  export_handler('raci', 'simple', project_id, req.body.raci, function (error) {
    if (error) {
      return api_response(error);
    }

    api_response(null, { path: '/api/data/raci/' + project_id + '_simple.csv' });
  });
});

app.post('/api/project/export/risk-csv/simple', hasProjectAccess, function(req, res, next) {
  var api_response = Api_Response(req, res, next);
  var data = req.body.risks;
  var project_id = req.body.project_id;

  export_handler('risk-csv', 'simple', project_id, data, function(error) {
    if (error) return api_response(error);

    api_response(null, { path: '/api/data/risk-csv/' + project_id + '_simple.csv' });
  });
});

app.post('/api/project/export/xml/simple', hasProjectAccess, function(req, res, next) {
  var api_response = Api_Response(req, res, next);
  var project_id = req.body.project_id;
  var tree = req.body.tree;

  export_handler('xml', 'simple', project_id, tree, function(error) {
    if (error) return api_response(error)

    api_response(null, { path: '/api/data/xml/' + project_id + '_simple.xml' });
  });
});
