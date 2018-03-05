var fs = require('fs');
var auth = Middlewares.secure.auth;
var Risk = Models.Risk;
var Activity = Models.Activity;
var amazon = Helpers.amazon;
var multipart = Middlewares.general.multipart();
var Api_Response = Middlewares.general.api_response;
var socket = Helpers.socket;

app.post('/api/project/risk/:id/file', auth, addFile);
app.post('/api/project/risk/:id/upload', auth, multipart, uploadFile);
app.delete('/api/project/risk/:risk_id/file/:file_id', auth, deleteFile);

app.get('/api/project/risk/:project_id', auth, function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  Risk
    .get_risks(req.params.project_id)
    .then(function (risks) {
      api_response(null, risks);
    })
    .catch(function (error) {
      api_response(error);
    });
});

/**
 * Add a new risk to task.
 */
app.post('/api/project/risk', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var risk = new Risk(req.body);
  risk.save(function (error) {
    if (error) {
      return generateResponse(error);
    }

    var activity = new Activity({
      action: 'activityFeed.addRisk',
      project: risk.project,
      user: req.user._id,
      risk: risk._id,
      riskName: risk.name
    });
    activity.save(function (error) {});

    // Send socket.io message.
    socket.addRisk(risk, req.user._id);

    generateResponse(null, risk);
  });
});

/**
 * Update risks.
 */
app.put('/api/project/risk/:riskId', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.riskId;
  Risk
    .update_risk(riskId, req.body)
    .then(function () {
      Risk.findById(riskId, function (error, risk) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.updateRisk',
          project: risk.project,
          user: req.user._id,
          risk: risk._id,
          riskName: risk.name
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.updateRisk(risk, req.user._id);
      });

      generateResponse(null);
    });
});

/**
 * Delete a risk.
 */
app.delete('/api/project/risk/:risk_id', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.risk_id;

  Risk.findById(riskId, function (error, risk) {
    if (error) {
      return generateResponse(error);
    }

    Risk
      .delete_risk(riskId)
      .then(function (error) {
        if (error) {
          return generateResponse(error);
        }

        var activity = new Activity({
          action: 'activityFeed.deleteRisk',
          project: risk.project,
          user: req.user._id,
          risk: risk._id,
          riskName: risk.name
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.deleteRisk(riskId, risk.project, req.user._id);

        generateResponse(null);
      });
  });
});

/**
 * Add task to risk.
 */
app.put('/api/project/risk/add_node/:risk_id/:node_id', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.risk_id;
  var nodeId = req.params.node_id;
  Risk
    .add_node(riskId, nodeId)
    .then(function () {
      Risk.findById(riskId, function (error, risk) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.attachRisk',
          project: risk.project,
          user: req.user._id,
          risk: risk._id,
          riskName: risk.name
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.attachRisk(risk, nodeId, req.user._id);
      });

      generateResponse(null);
    });
});

/**
 * Detach a risk from task.
 */
app.put('/api/project/risk/remove_node/:risk_id/:node_id', auth, function (req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.risk_id;
  var nodeId = req.params.node_id;
  Risk
    .remove_node(riskId, nodeId)
    .then(function () {
      Risk.findById(riskId, function (error, risk) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.detachRisk',
          project: risk.project,
          user: req.user._id,
          risk: risk._id,
          riskName: risk.name
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.detachRisk(risk, nodeId, req.user._id);
      });
      generateResponse(null);
    });
});

/**
 * Add file to risk.
 */
function addFile(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.id;
  var fileData = req.body;
  Risk.update(
    {
      _id: riskId
    },
    {
      $push: {
        _files: fileData
      }
    },
    function (error) {
      if (error) {
        return generateResponse(error);
      }

      Risk
        .findById(riskId)
        .exec(function (error, risk) {
          if (error) {
            return;
          }

          var activity = new Activity({
            action: 'activityFeed.addFileToRisk',
            project: risk.project,
            user: req.user._id,
            risk: risk._id,
            riskName: risk.name
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.addFileToRisk(risk, fileData, req.user._id);
        });

      generateResponse(null);
    }
  );
}

/**
 * Upload and add file to risk.
 */
function uploadFile(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.id;

  if (!req.files || !req.files.file) {
    return generateResponse('Please provide a file to upload.');
  }

  var fileObj = req.files.file;
  var file = fs.readFileSync(fileObj.path);
  var now = new Date();

  // Upload to S3 bucket.
  amazon
    .upload('risks', 'file', riskId + '-' + now.getTime() + '-' + fileObj.name, file)
    .then(function (url) {
      // Update the risk to add a file.
      var fileData = {
        from: 's3',
        name: fileObj.name,
        link: url,
        bytes: fileObj.size
      };

      Risk.update(
        {
          _id: riskId
        },
        {
          $push: {
            '_files': fileData
          }
        },
        function (error) {
          if (error) {
            return generateResponse(error);
          }

          Risk
            .findById(riskId)
            .exec(function (error, risk) {
              if (error) {
                return;
              }

              var activity = new Activity({
                action: 'activityFeed.addFileToRisk',
                project: risk.project,
                user: req.user._id,
                risk: risk._id,
                riskName: risk.name
              });
              activity.save(function (error) {});

              // Send socket.io message.
              socket.addFileToRisk(risk, fileData, req.user._id);
            });

          generateResponse(null, fileData);
        }
      );
    })
    .catch(function (error) {
      generateResponse(error);
    });
}

/**
 * Delete file from risk.
 */
function deleteFile(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var riskId = req.params.risk_id;
  var fileId = req.params.file_id;

  Risk.update(
    {
      _id: riskId
    },
    {
      $pull: {
        _files : {
          _id: fileId
        }
      }
    },
    function (error) {
      if (error) {
        return generateResponse(error);
      }

      Risk
        .findById(riskId)
        .exec(function (error, risk) {
          if (error) {
            return;
          }

          var activity = new Activity({
            action: 'activityFeed.deleteFileFromRisk',
            project: risk.project,
            user: req.user._id,
            risk: risk._id,
            riskName: risk.name
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.deleteFileFromRisk(risk, fileId, req.user._id);
        });

      generateResponse(null);
    }
  );
}
