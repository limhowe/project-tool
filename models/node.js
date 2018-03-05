var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;
var User = require('./user');
var async = require('async');

function addHours(date, h){
  date.setHours(date.getHours()+h);
  return date;
};

var NodeSchema = mongoose.Schema({
  title: { type: String, required: true},
  start_date: { type: String, required: false, default: new Date() },
  end_date: { type: String, required: false, default: addHours(new Date(), 24) },
  complete: { type: Number, required: false, default: 0 },
  task_id: {
    type: String
  },
  last_task_id: {
    type: Number
  },
  notes: { type: String, required: false, default: '+ add description' },

  duration: {
    value: { type: Number, required: false, default: 0 },
    type: { type: String, enum: ['minutes', 'hours', 'days', 'weeks', 'months'], default: 'minutes' }
  },
  optimisticTime: {
    value: { type: Number, required: false, default: 0 },
    type: { type: String, enum: ['minutes', 'hours', 'days', 'weeks', 'months'], default: 'minutes' }
  },
  pessimisticTime: {
    value: { type: Number, required: false, default: 0 },
    type: { type: String, enum: ['minutes', 'hours', 'days', 'weeks', 'months'], default: 'minutes' }
  },
  mostLikelyTime: {
    value: { type: Number, required: false, default: 0 },
    type: { type: String, enum: ['minutes', 'hours', 'days', 'weeks', 'months'], default: 'minutes' }
  },

  cost: { type: Number, required: false, default: 0 },
  // system: path and level fields
  path: { type: String, required: false, default: null}, // path to ierarchy:  ,ObjectId1,ObjectId2,
  level: { type: Number, required: false, default: 1},
  position: { type: Number, required: false, default: 1},
  position_path: { type: String, required: false, default: null },
  // project
  _project: { type: Schema.ObjectId, ref: 'Project', required: true },

  _state: [{
    user: { type: Schema.ObjectId, ref: 'User' },
    isList: { type: Boolean, required: false },
    isListParent: { type: Boolean, required: false },
    collapsed: { type: Boolean, required: false }
  }],

  _dependency: [{
    node: { type: Schema.ObjectId, ref: 'Node', required: false },
    type: { type: String, required: false }
  }],

  risks: [{ type: Schema.ObjectId, ref: 'Risk' }],
  comments: [{ type: Schema.ObjectId, ref: 'Comment' }],

  _quality: [{
    text: { type: String, required: false },
    completed: { type: Boolean, required: false }
  }],

  _files: [{
    from: { type: String, required: false },
    name: { type: String, required: false },
    link: { type: String, required: false },
    bytes: { type: Number, required: false },
    added_at: { type: Date, required: false, default: new Date() }
  }],

  assigned_users: [{
    user: { type: Schema.ObjectId, ref: 'User', required: false },
    referral: { type: Schema.ObjectId, ref: 'User', required: false },
    invite_email: { type: String, required: false }
  }],

  user: { type: Schema.ObjectId, ref: 'User', required: false },

  // parent/child relations
  _parent: { type: Schema.ObjectId, ref: 'Node' },
  _nodes: [{ type: Schema.ObjectId, ref: 'Node' }],
  // modification dates
  created_at: { type: Date, required: false, default: new Date() },
  updated_at: { type: Date, required: false, default: new Date() },
  agile_status: { type: String, required: false, default: '' },
  agile_board: { type: String, required: false, default: '' },
});

NodeSchema.pre('save', function (next) {
  if (this.isNew) {
    var self = this;
    var model = this.model(this.constructor.modelName);
    var parent_id = this._parent;

    async.parallel({
      position: function (callback) {
        if (!isNaN(parseInt(self.position, 10))) {
          callback(null, self.position);
        } else {
          model.getMaxPosition(self._project, parent_id, callback);
        }
      },
      position_path: function (callback) {
        if (parent_id) {
          model.getPositionPath(parent_id, function (err, path, position) {
            callback(err, { path: path, position: position });
          });
        } else {
          callback(null, null)
        }
      }
    },
    function (err, result) {
      self.position = result.position + 1;

      if (result.position_path) {
        self.position_path = ((result.position_path.path) ? (result.position_path.path + '#') : '') + parent_id + ',' + result.position_path.position;
      }

      next();
    })
  } else {
    next();
  }
});

NodeSchema.pre('remove', function (next) {
  var $Node = this.model('Node');
  var position = this.position;
  var parent_id = this._parent;

  $Node.remove({ path: new RegExp(this._id+'(?:,|$)', "i") }).exec();

  // update positions lower in level
  $Node
    .find({ _parent: parent_id, position: { $gt: position } })
    .snapshot(true)
    .exec(function (err, docs) {
      $Node.update({ _parent: parent_id, position: { $gt: position } }, { $inc: { position: -1 } }, { multi: true }).exec();

      if (docs) {
        docs.forEach(function (node) {
          $Node.updatePositionPath(node._id, node.position - 1, node._project, function (err) {});
        });
      }
    });

  next();
});

NodeSchema.methods.updateState = function ($state, done) {
  var Node = this.model('Node');
  var states = this._state;
  var options = { $set: { } };
  if ($state._id) {
    if (_.has($state, 'isList')) options.$set['_state.$.isList'] =  $state.isList;
    if (_.has($state, 'isListParent')) options.$set['_state.$.isListParent'] =  $state.isListParent;
    if (_.has($state, 'collapsed')) options.$set['_state.$.collapsed'] =  $state.collapsed;

    Node.update({ '_state._id': $state._id }, options, function (error, data) {
      console.log(data)

      done(error);
    });

  } else {
    options = { $push: { '_state': $state } };
    Node.update({ _id: this._id }, options, function (error) {
      done(error);
    });
  }
};

NodeSchema.statics.getMaxPosition = function (project_id, parent_id, cb) {
  var clause = (parent_id)
    ? { _parent: parent_id }
    : { _project: project_id, _parent: null };

  this.model('Node')
    .findOne(clause)
    .sort('-position')
    .exec(function (err, node) {
      if (err) {
        cb(err, null)
      } else {
        (node)
          ? cb(err, node.position)
          : cb(err, 0);
      }
    });
};

NodeSchema.statics.recalculate = function (parent_id, cb) {
  var Node = this.model('Node');
  async.parallel({
    unique: function (callback) {
      Node.distinct('position', { _parent: parent_id }, callback);
    },
    total: function (callback) {
      Node.count({ _parent: parent_id }, callback);
    }
  },
  function (err, result) {
    var toRecalculate = result.unique.length != result.total;

    if (toRecalculate) {
      Node
        .find({ _parent: parent_id })
        .sort('position')
        .exec(function (err, docs) {
          if (docs) {
            var i = 1;
            docs.forEach(function (val, index, array) {
              val.set('position', i);
              val.save(function (err) {});
              i++;
            })
          }
        })
    }

    cb(toRecalculate);
  });
};

NodeSchema.statics.changePosition = function (node_id, position) {
  var Node = this.model('Node');
  var deffered = Q.defer();

  Node.findById(node_id).populate('_parent').exec(function (error, node) {
    var query = {
      _project: node._project,
      _parent: node._parent ? node._parent._id : null
    };

    Node.find(query).sort('position').exec(function (error, nodes) {
      if (error) return deffered.reject(error);

      if (nodes.length < position) {
        position = 0;
      }

      if (nodes.length == position) {
        nodes.push(node);
      } else {
        nodes.splice(node.position, 1);
        nodes.splice(position, 0, node);
      }

      nodes.forEach(function (_node, index) {
        _node.set('position', index).save();
      });

      deffered.resolve(node);
    });
  });

  return deffered.promise;
};

NodeSchema.statics.getFreePosition = function (node_id, project_id, done) {
  var query = {
    _parent: node_id,
    _project: project_id
  };

  if (!node_id) {
    query = {
      _project: project_id,
      level: 1
    }
  }

  this.model('Node').find(query).exec(function (error, docs) {
    done(error, docs && docs.length + 1);
  });
};

NodeSchema.statics.updatePositionPath = function (node_id, position, project_id, cb) {
  this.model('Node')
    .find({
      _project: project_id,
      position_path: new RegExp('(?:#|^)'+ node_id +',(.*?)(?:#|$)', "i") })
    .snapshot(true)
    .exec(function (err, docs) {
      if (docs) {
        docs.forEach(function (e) {
          e.set(
            'position_path',
            e.position_path.replace(new RegExp('((?:.*?#|^)'+ node_id +',)\\d{1,}?((?:#.*|$))', "i"), "$1"+ position +"$2")
          );

          e.save(function (err) {});
        })
      }

      cb(err);
    })
};

NodeSchema.statics.updateChildPositionPath = function (node, project_id, done) {
  var Node  = this.model('Node');
  var where = {
    _project: project_id,
    position_path: new RegExp('(?:#|^)'+ node.id +',(.*?)(?:#|$)', "i")
  };

  var regex = new RegExp('(^.*)(' + node.id + ',[0-9]+)(.*$)', 'i');
  var replace_with = node.position_path + '#' + node.id + ',' + node.position + '$3';

  Node.find(where).snapshot(true).exec(function (err, docs) {
    if (docs) {
      docs.forEach(function (e) {
        e.set('position_path', e.position_path.replace(regex, replace_with));
        e.set('path', e.path.replace(new RegExp('(^.*)(' + node.id +')', 'i'), node.path + ',' + node.id + ''));
        e.save(function (err) {});
      });
    }

    done(err);
  });
};

NodeSchema.statics.updateChildPositions = function (node_id, project_id, done) {
  var query = { _parent: node_id, _project: project_id };
  if (!node_id) query = { level: 1, _project: project_id };

  this.model('Node').find(query).sort('position').exec(function (error, docs) {
    docs.forEach(function (doc, i) {
      doc.set('position', i+1);
      doc.save(function () {});
    });

    if (done) done();
  });
};

NodeSchema.statics.getPositionPath = function (node_id, cb) {
  this.model('Node')
  .findOne({ _id: node_id })
  .exec(function (err, node) {
    (node)
      ? cb(err, node.position_path, node.position)
      : cb(err, null, 0);
  })
};

NodeSchema.index({_project: 1, _parent:1 });
NodeSchema.index({_project: 1, path:1 });
NodeSchema.index({_project: 1, position_path:1 });
NodeSchema.index({_project: 1, title:1 });
NodeSchema.index({_project: 1, level:1 });

module.exports = mongoose.model('Node', NodeSchema);
