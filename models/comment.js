var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;

var Comment = mongoose.Schema({
  text: { type: String, required: true },
  level: { type: Number, required: true, default: 0 },
  node: { type: Schema.ObjectId, ref: 'Node' },
  user: { type: Schema.ObjectId, ref: 'User' },
  upvotes: [{ type: Schema.ObjectId, ref: 'User' }],
  parent: { type: Schema.ObjectId, ref: 'Comment' },
  children: [{ type: Schema.ObjectId, ref: 'Comment' }],
  created_at: { type: Date, required: true, default: new Date() }
});

Comment.post('remove', function (_comment) {
  var $Node = this.model('Node');
  var $Comment = this.model('Comment');

  _comment.populate('parent node children', function (error, comment) {
    if (comment.parent) {
      comment.parent.children.pull(comment._id);
      comment.parent.save();
    }

    if (comment.level === 0) {
      comment.node.comments.pull(comment._id);
      comment.node.save();
    }

    if (comment.children) {
      comment.children.forEach(function (child) {
        child.remove();
      });
    }
  });
});

Comment.statics.all = function (node_id, done) {
  var $Comment = this.model('Comment');
  // TODO BUG
  var max_level = 5;

  function populate_comments (docs, child_path, user_path, level, done) {
    if (level >= max_level) return done(null, docs);

    child_path += '.children';

    if (!user_path) {
      user_path = 'children.user';
    } else {
      user_path = 'children.' + user_path;
    }

    var opts = [
      { path: child_path},
      { path: user_path, model: 'User', select: 'name'}
    ];

    $Comment.populate(docs, opts, function (error, comments) {
      if (error) return done(error);
      populate_comments(comments, child_path, user_path, level + 1, done);
    });
  };

  var query = { node: node_id, level: 0 };

  $Comment.find(query).populate('user children').exec(function (error, docs) {
    if (error) return done(error);
    populate_comments(docs, 'children', '', 1, done);
  });
};

module.exports = mongoose.model('Comment', Comment);
