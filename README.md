<a title="By DuffDudeX1 at en.wikipedia (Transferred from
          en.wikipedia) [Public domain], from Wikimedia Commons"
   href="http://commons.wikimedia.org/wiki/File%3APC_Load_Letter.jpg">
  <img style="max-width: 100%;" alt="PC Load Letter"
       src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/PC_Load_Letter.jpg/512px-PC_Load_Letter.jpg"/>
</a>

[Jenkins][jenkins-home] is an older piece of technology. And yet, if
you use Jenkins, it is vitally important to your every day work.

[jenkins-home]: http://jenkins-ci.org

And so enters pc-load-letter:

> pc-load-letter is a small utility for loading jobs into jenkins, and
> unloading jobs from Jenkins. Jobs are saved off as their native
> format: XML.

## Installation

    npm install -g jenkins-pc-load-letter

## Usage

### Unloading Jobs

Imagine that..

* A jenkins is running at https://jenkins.company.com:8080.
* You created a job on this jenkins named "great-job" and you want to
  save it off in a file.

You can save this job off as XML with:

    pc-load-letter unload --jenkins https://jenkins.company.com:8080 --job great-job

This command will cause a file named "great-job.xml" to come into
existence that matches the current state of "great-job" on your
jenkins. You could check this into source control for safe keeping, or
modify it with your favorite text editor and load it back in.

### Loading Jobs

Imagine that..

* A jenkins is running at https://jenkins.company.com:8080.
* You have previously unloaded a job named "great-job" and saved it
  off as XML in a file named "great-job.xml"
* The jenkins that is running does not have a job named "great-job,"
  or it does have this job, but you want what's in the XML file to
  replace what's on the server.

You can take the contents of a formerly-saved-off job and load it into
jenkins with:

    pc-load-letter load --jenkins https://jenkins.company.com:8080 --file great-job.xml

This command will look for a file named "great-job.xml" and create a
job named "great-job" on the jenkins instance. It will update this job
so that it matches the file contents if the job already exists.
