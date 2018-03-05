var mongoose = require('mongoose');
var Schema = mongoose.Schema;
// var mongoosePaginate = require('mongoose-paginate');

var Activity = mongoose.Schema({
  action: { type: String, required: true },
  project: { type: Schema.ObjectId, ref: 'Project', required: true },
  user: { type: Schema.ObjectId, ref: 'User', required: true },
  node: { type: Schema.ObjectId, ref: 'Node', required: false },
  nodeTitle: { type: String, required: false },
  quality: { type: String, required: false },
  list: { type: Schema.ObjectId, ref: 'List', required: false },
  listName: { type: String, required: false },
  board: { type: Schema.ObjectId, ref: 'Board', required: false },
  boardName: { type: String, required: false },
  comment: { type: Schema.ObjectId, ref: 'Comment', required: false },
  commentText: { type: String, required: false },
  risk: { type: Schema.ObjectId, ref: 'Risk', required: false },
  riskName: { type: String, required: false },
  resource: { type: String, required: false },
  created_at: { type: Date, required: true, default: new Date() }
});

Activity.pre('save', function (next) {
  var activity = this;
  activity.set('created_at', new Date());
  next();
});

Activity.post('save', function (activity) {
  activity.populate('user', function(error, activity){
    io.to(activity.project).emit('activity.add', activity);
  });
});

// Activity.plugin(mongoosePaginate);

module.exports = mongoose.model('Activity', Activity);
