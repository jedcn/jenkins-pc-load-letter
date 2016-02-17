var jenkins = require('jenkins');
var Promise = require('bluebird');
var fs = require('fs');
var chalk = require('chalk');

Promise.promisifyAll(fs);

function PC(options) {
  if (options.ignoreSSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  if (options.files === undefined || options.jenkinsServer === undefined) {
    throw new Error('Must pass options object with keys "files" and "jenkinsServer"');
  }

  if (options.jobsRegex) {
    this.jobsRegex = new RegExp(options.jobsRegex);
  }
  this.files = options.files;
  this.jenkins = jenkins({
    baseUrl: options.jenkinsServer,
    promisify: true,
  });
}

PC.prototype.unload = function () {
  var self = this;
  return Promise.all([
    this._getJobs(),
    this._getViews(),
  ]).then(function () {
    console.log('\n');
    if (self.successfullyProcessedCount) {
      console.log(chalk.green(self.successfullyProcessedCount) + ' job(s) succesfully saved.');
    }
    if (self.failedToProcessCount) {
      console.log(chalk.red(self.failedToProcessCount) + ' job(s) could not be saved.');
    }
    console.log(chalk.yellow('Done!\n'));
  });
};

PC.prototype.load = function () {
  var self = this;
  return Promise.all([
    this.jenkins.job.list().then(function (jobList) {
      self.existingJobs = jobList;
    }),
    this._readJobsFromDisk(),
  ]).then(function (existingJobs) {
    return self._loadJobsIntoJenkins(existingJobs);
  }).then(function () {
    console.log('\n');
    if (self.successfullyProcessedCount) {
      console.log(
        chalk.green(self.successfullyProcessedCount) + ' job(s) succesfully loaded into Jenkins.'
      );
    }
    if (self.failedToProcessCount) {
      console.log(
        chalk.red(self.failedToProcessCount) + ' job(s) could not be loaded into Jenkins.'
      );
    }
    console.log(chalk.yellow('Done!\n'));
  });
};

PC.prototype._readJobsFromDisk = function () {
  var self = this;
  console.log('Reading files from disk...\n');
  return Promise.try(function () {
    self.fileContents = {};
    if (self.files.length < 1) {
      throw new Error('No files found at that path to load');
    }
    self.jobCount = self.files.length;
    self.jobProcessedCount = 0;
    self.successfullyProcessedCount = 0;
    self.failedToProcessCount = 0;
    return Promise.map(self.files, function (filePath) {
      var jobName = filePath.match(/([A-z0-9\-]*)(?=(\.|$))/)[0];
      var currentWorkingDirectory = process.cwd();
      var fullPath = filePath;
      if (filePath.charAt[0] !== '/') {
        fullPath = currentWorkingDirectory + '/' + filePath;
      }
      return fs.readFileAsync(fullPath, 'utf-8').then(function (contents) {
        self.fileContents[jobName] = {};
        self.fileContents[jobName].contents = contents;
      }).catch(function (err) {
        var msg;
        self.jobProcessedCount++;
        self.failedToProcessCount++;
        msg = chalk.red('     ✘ Couldnt read ' + self._getJobCounter() +
                            ' ' + fullPath + ' from disk.');
        console.log(msg, err);
      });
    });
  });
};

PC.prototype._loadJobsIntoJenkins = function () {
  var self = this;
  var jobLoadPromises = [];
  Object.keys(this.fileContents).forEach(function (jobName) {
    var i;
    var existingJob = false;

    for (i = 0; i < self.existingJobs.length; i++) {
      if (self.existingJobs[i].name === jobName) {
        existingJob = true;
        break;
      }
    }

    if (existingJob) {
      jobLoadPromises.push(
        self.jenkins.job.config(jobName, self.fileContents[jobName].contents).then(function () {
          var msg;
          self.jobProcessedCount++;
          self.successfullyProcessedCount++;
          msg = chalk.green('     ✔ Modified existing job ' + self._getJobCounter() + ' " ') +
            chalk.cyan(jobName) +
            chalk.green('" succesfully.');
          console.log(msg);
        }).catch(function (err) {
          var msg;
          self.jobProcessedCount++;
          self.failedToProcessCount++;
          msg = chalk.red('     ✘ Could not modify existing job ' +
                              self._getJobCounter() + '"') +
            chalk.cyan(jobName) +
            chalk.red('"');
          console.log(msg, err);
        })
      );
    } else {
      jobLoadPromises.push(
        self.jenkins.job.create(jobName, self.fileContents[jobName].contents).then(function () {
          var msg;
          self.successfullyProcessedCount++;
          self.jobProcessedCount++;
          msg = chalk.green('     ✔ Created new job ' +
            self._getJobCounter() + ' "') + chalk.cyan(jobName) +
            chalk.green('" succesfully.');
          console.log(msg);
        }).catch(function (err) {
          var msg;
          self.jobProcessedCount++;
          self.failedToProcessCount++;
          msg = chalk.red('     ✘ Could not create new job ' +
            self._getJobCounter() + ' "') + chalk.cyan(jobName) +
            chalk.red('"');
          console.log(msg, err);
        })
      );
    }
  });
  return Promise.all(jobLoadPromises);
};

PC.prototype._getJobs = function () {
  var self = this;
  console.log('Fetching job list from Jenkins...');
  return this.jenkins.job.list().then(function (jobList) {
    var matchingJobs = [];
    if (self.jobsRegex) {
      matchingJobs = jobList.filter(function (job) {
        return self.jobsRegex.test(job.name);
      });
    } else {
      matchingJobs = jobList;
    }
    self.jobCount = matchingJobs.length;
    self.jobProcessedCount = 0;
    self.successfullyProcessedCount = 0;
    self.failedToProcessCount = 0;

    if (self.jobCount < 1) {
      throw new Error('No jobs found to unload.');
    }
    return Promise.map(matchingJobs, function (job) {
      return self._getJobXML(job.name);
    });
  });
};

PC.prototype._getJobXML = function (jobName) {
  var self = this;
  var filePath = self.files + '/' + jobName + '.xml';

  return this.jenkins.job.config(jobName).then(function (xml) {
    return fs.writeFileAsync(filePath, xml);
  }).then(function () {
    self.jobProcessedCount++;
    self.successfullyProcessedCount++;
    console.log(
      chalk.green('     ✔ Saved job ' + self._getJobCounter()) + ' ' +
      chalk.cyan(jobName) +
      chalk.green('" to ') +
      filePath
    );
  }).catch(function (err) {
    var errMsg;
    self.jobProcessedCount++;
    self.failedToProcessCount++;

    errMsg = '     ✘ Could not save job ' + self._getJobCounter();

    console.log(
      chalk.red(errMsg) +
      chalk.cyan(jobName) +
      chalk.red('"\n      Error Message: ' + err.message)
    );
  });
};

PC.prototype._getJobCounter = function () {
  return '[' + this.jobProcessedCount + '/' + this.jobCount + ']';
};

PC.prototype._getViews = function () {
  // TODO: Implement this
  return true;
};

module.exports = PC;
