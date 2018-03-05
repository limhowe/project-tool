var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;

var ProjectSchema = new Schema({
  name: { type: String, required: true },
  _user: { type: Schema.ObjectId, ref: 'User' },
  _users: [{
    user: { type: Schema.ObjectId, ref: 'User', required: false },
    referral: { type: Schema.ObjectId, ref: 'User', required: false },
    invite_email: { type: String, required: false }
  }],
  boards: [{ type: Schema.ObjectId, ref: 'Board' }],
  description: { type: String, required: false },
  settings: {
    show_numbers: { type: Boolean, default: true },
    use_quality: {type: Boolean, default: false },
    hide_completed: {type: Boolean, default: false },
    gantt_start_date: {type: String, enum: ['CURRENT_DATE','PROJECT_CREATION_DATE','FIRST_TASK_START_DATE'], default: 'PROJECT_CREATION_DATE' }
  },
  isDemo: { type: Boolean, default: false },
  timezone: { type: String, require: false },
  dateformat: { type: String, require: false },
  has_image: { type: Boolean, required: false },
  last_task_id: {
    type: Number
  },
  created_at: { type: Date, required: false, default: new Date() }
});

// ProjectSchema.path('name').validate( validation.uniqueFieldInsensitive('Project', 'name' ), 'That project name already exists.' );

ProjectSchema.virtual('id').get(function(){
  return this._id.toHexString();
});

// Ensure virtual fields are serialised.
ProjectSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    return ret;
  }
});

ProjectSchema.pre('remove', function (next) {
  var self = this;

  this
    .model('Node')
    .remove({
      _project: self._id
    })
    .exec();

  this
    .model('Board')
    .remove({
      project: self._id
    })
    .exec();

  this
    .model('Raci')
    .remove({
      project: self._id
    })
    .exec();

  next();
});

ProjectSchema.index({ _user: 1 });

module.exports = mongoose.model('Project', ProjectSchema);
