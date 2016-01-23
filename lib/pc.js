var jenkins = require('jenkins'),
    Promise = require('bluebird'),
    fs = require('fs'),
    chalk = require('chalk');

Promise.promisifyAll(fs);

function PC(options) {
    if(options.ignoreSSL){
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    this.files = options.files;
    this.jenkins = jenkins({
        baseUrl: options.jenkinsServer,
        promisify: true
    });
}

PC.prototype.unload = function(){
    return Promise.all([
        this._getJobs(),
        this._getViews()
    ]).then(function(){
        console.log(chalk.yellow('\nDone!'));
    });
};

PC.prototype.load = function(){
    // TODO: Implement this.
};

PC.prototype._getJobs = function(){
    var self = this;
    console.log('Fetching job list from Jenkins...');
    return this.jenkins.job.list().then(function(jobList) {
        self.jobCount = jobList.length;
        self.jobProcessedCount = 0;
        return Promise.map(jobList, function(job){
            return self._getJobXML(job.name);
        });
    });
};

PC.prototype._getJobXML = function(jobName){
    var self = this,
        filePath = self.files + '/' + jobName + '.xml';
    return this.jenkins.job.config(jobName).then(function(xml){
        return fs.writeFileAsync(filePath, xml);
    }).then(function(){
        self.jobProcessedCount++;
        console.log(
            chalk.green('     ✔ Saved job ['+self.jobProcessedCount+'/'+self.jobCount+'] "') +
            chalk.cyan(jobName) +
            chalk.green('" to ') +
            filePath
        );
    });
};

PC.prototype._getViews = function(){
    // TODO: Implement this
    return true;
};


module.exports = PC;
