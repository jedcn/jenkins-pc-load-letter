var jenkins = require('jenkins'),
  Promise = require('bluebird'),
  fs = require('fs'),
  chalk = require('chalk');

Promise.promisifyAll(fs);

function PC(options) {
  if (options.ignoreSSL) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  if (options.files === undefined || options.jenkinsServer === undefined) {
      throw new Error('Must pass options object to constructor with keys "files" and "jenkinsServer" defined');
    }
  this.files = options.files;
  this.jenkins = jenkins({
      baseUrl: options.jenkinsServer,
      promisify: true
    });
}

PC.prototype.unload = function () {
  var self = this;
  return Promise.all([
      this._getJobs(),
      this._getViews()
    ]).then(function () {
      if (self.successfullyProcessedCount) {
          console.log(chalk.green(self.successfullyProcessedCount) + ' jobs succesfully saved.');
        }
      if (self.failedToProcessCount) {
          console.log(chalk.red(self.failedToProcessCount) + ' jobs could not be saved.');
        }
      console.log(chalk.yellow('Done!\n'));
    });
};

PC.prototype.load = function () {
    // TODO: Implement this.
};

PC.prototype._getJobs = function () {
  var self = this;
  console.log('Fetching job list from Jenkins...');
  return this.jenkins.job.list().then(function (jobList) {
      self.jobCount = jobList.length;
      self.jobProcessedCount = 0;
      self.successfullyProcessedCount = 0;
      self.failedToProcessCount = 0;
      return Promise.map(jobList, function (job) {
          return self._getJobXML(job.name);
        });
    });
};

PC.prototype._getJobXML = function (jobName) {
  var self = this,
      filePath = self.files + '/' + jobName + '.xml';
  return this.jenkins.job.config(jobName).then(function (xml) {
          return fs.writeFileAsync(filePath, xml);
        }).then(function () {
          self.jobProcessedCount++;
          self.successfullyProcessedCount++;
          console.log(
                chalk.green('     ✔ Saved job [' + self.jobProcessedCount + '/' + self.jobCount + '] "') +
                    chalk.cyan(jobName) +
                        chalk.green('" to ') +
                            filePath
            );
        }).catch(function (err) {
          self.jobProcessedCount++;
          self.failedToProcessCount++;

          var errMsg = '     ✘ Could not save job [' + self.jobProcessedCount + '/';
          errMsg += self.jobCount + '] "';

          console.log(
                chalk.red(errMsg) +
                    chalk.cyan(jobName) +
                        chalk.red('"\n      Error Message: ' + err.message)
            );
        });
};

PC.prototype._getViews = function _getViews() {
    // TODO: Implement this
  return true;
};

module.exports = PC;
