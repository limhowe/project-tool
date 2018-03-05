var tasks = fs
.readdirSync(__dirname + '/')
.filter(function (name) { return name !== 'index.js'; })
.reduce(function (tasks, task) {
  tasks.push(require(__dirname + '/' + task));
  return tasks;
}, [])
.forEach(function (job) {
  var CronJob = require('cron').CronJob;
  var time = '0 0 */6 * * *';

  console.log('scheduling task...');
  var task = new CronJob(time, job, null, true, null);
});
