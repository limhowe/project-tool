var Api_Response = Middlewares.general.api_response;
var CommentModel = Models.Comment;
var NodeModel = Models.Node;
var Activity = Models.Activity;
var auth = Middlewares.secure.auth;
var mailer = Helpers.mailer();
var translater = Helpers.translater;
var socket = Helpers.socket;

app.post('/api/node/:nodeId/comments', auth, addComment);
app.put('/api/comment/:id', updateComment);
app.delete('/api/comment/:id', auth, removeComment);

app.get('/api/node/:id/comments', function (req, res, next) {
  var api_response = Api_Response(req, res, next);
  CommentModel.all(req.params.id, api_response);
});

/**
 * Add new comment.
 */
function addComment(req, res, next) {
  var generateResponse = Api_Response(req, res, next);

  var nodeId = req.params.nodeId;

  var payload = req.body;
  payload.user = req.user._id;

  NodeModel
    .findById(nodeId)
    .populate('user')
    .populate('assigned_users.user')
    .exec(function (error, node) {
      if (error) {
        return generateResponse(error);
      }

      if (!node) {
        return generateResponse('node not found');
      }

      node = node.toObject();

      var user_emails = _.chain(node.assigned_users)
        .map(function (value) {
          return value.user;
        })
        .union([
          node.user
        ])
        .compact()
        .filter(function (user) {
          return user._id.toString() !== req.user._id.toString();
        })
        .map(function (user) {
          return _.pick(user, 'email');
        })
        .uniq(function (value) {
          return value.email;
        })
        .value();

      var username = /^\d+$/.test(req.user.username) ? req.user.email : req.user.username;


  _.each(user_emails, function (user) {

    Helpers.user.get_language(user.email, function(user_language){

      mailer.send({
        to: [user],
        subject: translater.translate('$[1] wrote a comment on the task : "$[2]"', user_language, [ username, node.title ]),
      }, {
        name: 'task/comment',
        language: user_language,
        params: {
          domain: config.get('domain'),
          user: req.user,
          username: username,
          node: node,
          task: node.title,
  		    text: payload.text
        }
      });

    });

  });

      if (!payload.mentionedUsers || !payload.mentionedUsers.length) {
        return;
      }

      var addresses = [];
      payload.mentionedUsers.forEach(function (m_user) {
        addresses.push({
          email: m_user
        });
      });

  _.each(addresses, function (user) {

    Helpers.user.get_language(user.email, function(user_language){

      mailer.send({
        to: [user],
        subject: translater.translate('$[1] mentioned you in comment.', user_language, [ username ]),
      }, {
        name: 'task/mention',
        language: user_language,
        params: {
          domain: config.get('domain'),
          user: req.user,
          username: username,
          node: node,
          task: node.title,
          text: payload.text
        }
      });

    });

  });

});

  var comment = new CommentModel(payload);

  comment.save(function (error) {
    if (error) {
      return generateResponse(error);
    }

    NodeModel.findById(comment.node, function (error, node) {
      if (error) {
        return generateResponse(error);
      }

      if (comment.parent) {
        CommentModel.findById(comment.parent, function (error, parent) {
          if (error) {
            return generateResponse(error);
          }

          parent.children.push(comment._id);
          parent.save(function (error) {
            comment.populate('user', function (error, comment) {
              if (error) {
                return generateResponse(error);
              }

              var activity = new Activity({
                action: 'activityFeed.addComment',
                project: node._project,
                user: req.user._id,
                node: node._id,
                nodeTitle: node.title,
                comment: comment._id,
                commentText: comment.text
              });
              activity.save(function (error) {});

              // Send socket.io message.
              socket.addComment(comment, node, req.user._id);

              generateResponse(null, comment);
            });
          });
        });
      } else {
        node.comments.push(comment._id);
        node.save(function (error) {
          comment.populate('user', function (error, comment) {
            if (error) {
              return generateResponse(error);
            }

            var activity = new Activity({
              action: 'activityFeed.addComment',
              project: node._project,
              user: req.user._id,
              node: node._id,
              nodeTitle: node.title,
              comment: comment._id,
              commentText: comment.text
            });
            activity.save(function (error) {});

            // Send socket.io message.
            socket.addComment(comment, node, req.user._id);

            generateResponse(null, comment);
          });
        });
      }
    });
  });
}

function removeComment(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var commentId = req.params.id;

  CommentModel.findById(commentId, function (error, comment) {
    if (error) {
      return generateResponse(error);
    }

    if (!comment) {
      return generateResponse('comment was not found');
    }

    var nodeId = comment.node;

    comment.remove(function (error) {
      if (error) {
        return generateResponse(error);
      }

      NodeModel.findById(nodeId, function (error, node) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.removeComment',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title,
          comment: comment._id,
          commentText: comment.text
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.removeComment(commentId, node, req.user._id);
      });

      generateResponse(null);
    });
  });
}

function updateComment(req, res, next) {
  var generateResponse = Api_Response(req, res, next);
  var commentId = req.params.id;
  var userId = req.user._id;
  var upvote = req.body.upvote;
  var text = req.body.text;

  CommentModel.findById(commentId, function (error, comment) {
    if (upvote) {
      (upvote == 1) ? comment.upvotes.push(userId) : comment.upvotes.pull(userId);
      comment.save(function (error) {
        if (error) {
          return generateResponse(error);
        }

        NodeModel.findById(comment.node, function (error, node) {
          if (error) {
            return;
          }

          var activity = new Activity({
            action: 'activityFeed.upvoteComment',
            project: node._project,
            user: req.user._id,
            node: node._id,
            nodeTitle: node.title,
            comment: comment._id,
            commentText: comment.text
          });
          activity.save(function (error) {});

          // Send socket.io message.
          socket.upvoteComment(comment, upvote == 1, node, userId);
        });

        generateResponse(null);
      });
    }

    if (text) {
      comment.text = text;
      comment.save(generateResponse);

      NodeModel.findById(comment.node, function (error, node) {
        if (error) {
          return;
        }

        var activity = new Activity({
          action: 'activityFeed.updateComment',
          project: node._project,
          user: req.user._id,
          node: node._id,
          nodeTitle: node.title,
          comment: comment._id,
          commentText: comment.text
        });
        activity.save(function (error) {});

        // Send socket.io message.
        socket.updateComment(comment, node, userId);
      });
    }
  });
}
