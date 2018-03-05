var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validation = Helpers.model.validation;

var Risk = mongoose.Schema({
  node: [{ type: Schema.ObjectId, ref: 'Node', required: false}],
  project: { type: Schema.ObjectId, required: true},
  name: { type: String },
  topic: { type: String },
  level: { type: Number, default: 1 },
  probability: { type: Number, default: 0 },
  impact: { type: Number, default: 0 },
  mitigation: { type: String },
  contingency: { type: String },
  consequence: { type: String },
  created_at: { type: Date, required: false, default: new Date() },
  _files: [{
    from: { type: String, required: false },
    name: { type: String, required: false },
    link: { type: String, required: false },
    bytes: { type: Number, required: false },
    added_at: { type: Date, required: false, default: new Date() }
  }],
});

Risk.statics.get_risks = function(project_id){
  var deffered = Q.defer();
  var Risk = this.model('Risk');

  Risk.find({'project':project_id})
  .populate('node','title _id')
  .exec(function(error, data){
    error ? deffered.reject(error) : deffered.resolve(data);
  })

  return deffered.promise;
 }

Risk.statics.update_risk = function (riskId, payload) {
  var deffered = Q.defer();
  var Risk = this.model('Risk');
  Risk.update( { _id: riskId }, { $set: payload }, function (error, data) {
    error ? deffered.reject(error) : deffered.resolve(data);
  });
  return deffered.promise;
};

/**
 * Delete a risk.
 * @param {String} riskId
 */
Risk.statics.delete_risk = function (riskId) {
  var deffered = Q.defer();
  var Risk = this.model('Risk');
  Risk
    .find({
      _id: riskId
    })
    .remove()
    .exec(function (error) {
      error ? deffered.reject() : deffered.resolve();
    });

  return deffered.promise;
};

/**
 * Add task to risk.
 */
Risk.statics.add_node = function (riskId, nodeId) {
  var deffered = Q.defer();
  var Risk = this.model('Risk');
  Risk.findOne({_id: riskId}, function (error, risk) {
    risk.node.push(nodeId);
    risk.save(function (error) {
      error ? deffered.reject() : deffered.resolve();
    })
  });
  return deffered.promise;
};

Risk.statics.remove_node = function (riskId, nodeId) {
  var deffered = Q.defer();
  var Risk = this.model('Risk');
  Risk.findOne({_id: riskId}, function (error, risk) {
    risk.node.splice(risk.node.indexOf(nodeId));
    risk.save(function (error, data) {
      error ? deffered.reject() : deffered.resolve();
    });
  });
  return deffered.promise;
};

module.exports = mongoose.model('Risk', Risk);
