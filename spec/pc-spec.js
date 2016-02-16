var rewire = require('rewire');
var PC = rewire('../lib/pc');
var Promise = require('bluebird');

describe('Paper Cassette', function () {
  var mockFiles = {
    'some/directory/cactus.xml': {
      contents: '<xml>Cactus</xml>',
    },
    'some/diva/falcon.xml': {
      contents: '<xml>Falcon</xml>',
    },
    'some/diva/cbl.xml': {
      contents: '<xml>CBL</xml>',
    },
    'some/diva/directory/blamaste.xml': {
      contents: '<xml>Blamaste</xml>',
    },
    'some/diva/president/oblama.xml': {
      contents: '<xml>oblama</xml>',
    },
    'some/bad-blammajamma.xml': {
      contents: '<xml>bad-blamma-jamma</xml>',
    },
  };

  var mockFs = {
    writeFileAsync: jasmine.createSpy('writeFileAsync').and.callFake(function () {
      return true;
    }),
    readFileAsync: jasmine.createSpy('readFileAsync').and.callFake(function (path) {
      return Promise.try(function () {
        var match = null;
        var key;
        for (key in mockFiles) {
          if (path.indexOf(key) > -1) {
            match = mockFiles[key].contents;
            break;
          }
        }
        if (!match) {
          throw new Error('Cant find that file or something.');
        }
        return match;
      });
    }),
  };

  var setConfigSpy = jasmine.createSpy('setConfig');
  var createConfigSpy = jasmine.createSpy('createConfig');

  var mockJenkins = function () {
    return {
      job: {
        list: function () {
          return Promise.try(function () {
            return [
              { name: 'Cactus' },
              { name: 'Gondor' },
              { name: 'Foobar' },
            ];
          });
        },
        config: function (jobName, xml) {
          // Setting job config
          if (xml) {
            setConfigSpy(jobName, xml);
            return Promise.try(function () {
              if (jobName === 'buzz') {
                return 'Error: Cannot feel buzz.';
              }
            });
          // Getting job config
          }
          return Promise.try(function () {
            switch (jobName) {
              case 'Cactus':
                return '<xml>Cactus</xml>';
              case 'Gondor':
                return '<xml>Gondor</xml>';
              case 'Foobar':
                return '<xml>Foobar</xml>';
              default:
                return undefined;
            }
          });
        },
        create: function (jobName, xml) {
          createConfigSpy(jobName, xml);
          return Promise.resolve();
        },
      },
    };
  };

  function instrumentPC(mockedJenkinsApi, mockedFsApi) {
    PC.__set__({
      jenkins: mockedJenkinsApi,
      fs: mockedFsApi,
    });
  }

  beforeEach(function () {
    mockFs.writeFileAsync.calls.reset();
    setConfigSpy.calls.reset();
    instrumentPC(mockJenkins, mockFs);
  });

  it('should throw an exception if constructed without the proper options', function () {
    var pc;
    expect(function () {
      pc = new PC();
    }).toThrow();

    expect(function () {
      pc = new PC({
      });
    }).toThrow();

    expect(function () {
      pc = new PC({
        files: '/foo',
      });
    }).toThrow();

    expect(function () {
      pc = new PC({
        files: '/foo',
        jenkinsServer: 'myJenkins.roving.com',
      });
      expect(pc).not.toBe(null);
    }).not.toThrow();
  });

  describe('#unload', function () {
    it('write all the available jenkins jobs to disk, in the directory specified', function (done) {
      var pc = new PC({
        files: '/foo',
        jenkinsServer: 'cactus.roving.com',
      });
      expect(mockFs.writeFileAsync).not.toHaveBeenCalled();
      pc.unload().then(function () {
        expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
          '/foo/Cactus.xml', '<xml>Cactus</xml>'
        );
        expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
          '/foo/Gondor.xml', '<xml>Gondor</xml>'
        );
        expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
          '/foo/Foobar.xml', '<xml>Foobar</xml>'
        );
        expect(mockFs.writeFileAsync).not.toHaveBeenCalledWith(
          '/foo/SmallBets.xml', '<xml>SmallBets</xml>'
        );
        done();
      });
    });

    it('should only save jobs matching the --jobs parameter', function (done) {
      Promise.try(function () {
        var pc = new PC({
          files: '/myJobs',
          jenkinsServer: 'cactus.roving.com',
          jobsRegex: 'Cactus',
        });
        expect(mockFs.writeFileAsync).not.toHaveBeenCalled();
        return pc.unload().then(function () {
          expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
            '/myJobs/Cactus.xml', '<xml>Cactus</xml>'
          );
          expect(mockFs.writeFileAsync).not.toHaveBeenCalledWith(
            '/myJobs/Gondor.xml', '<xml>Gondor</xml>'
          );
        });
      }).then(function () {
        var pc = new PC({
          files: '/myJobs',
          jenkinsServer: 'cactus.roving.com',
          jobsRegex: '(Gondor|Foobar)',
        });
        mockFs.writeFileAsync.calls.reset();
        expect(mockFs.writeFileAsync).not.toHaveBeenCalled();
        return pc.unload().then(function () {
          expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
            '/myJobs/Gondor.xml', '<xml>Gondor</xml>'
          );
          expect(mockFs.writeFileAsync).toHaveBeenCalledWith(
            '/myJobs/Foobar.xml', '<xml>Foobar</xml>'
          );
          expect(mockFs.writeFileAsync).not.toHaveBeenCalledWith(
            '/myJobs/Cactus.xml', '<xml>Cactus</xml>'
          );
        });
      }).then(function () {
        done();
      });
    });

    it('should alert the user if no matching jobs are available', function (done) {
      var pc = new PC({
        files: '/myJobs',
        jenkinsServer: 'cactus.roving.com',
        jobsRegex: 'SmallBets',
      });
      expect(pc.unload).toThrow();
      done();
    });
  });

  describe('#load', function () {
    it('it should load all the jobs on disk into jenkins', function (done) {
      Promise.try(function () {
        var pc = new PC({
          files: [
            'some/directory/cactus.xml',
            'some/diva/falcon.xml',
            'some/diva/cbl.xml',
            'some/diva/directory/blamaste.xml',
            'some/diva/president/oblama.xml',
          ],
          jenkinsServer: 'cactus.roving.com',
        });
        expect(mockFs.readFileAsync).not.toHaveBeenCalled();
        createConfigSpy.calls.reset();
        expect(createConfigSpy).not.toHaveBeenCalled();
        return pc.load().then(function () {
          expect(mockFs.readFileAsync).toHaveBeenCalled();
          expect(createConfigSpy).toHaveBeenCalledWith(
            'cactus', '<xml>Cactus</xml>'
          );
          expect(createConfigSpy).toHaveBeenCalledWith(
            'falcon', '<xml>Falcon</xml>'
          );
          expect(createConfigSpy).toHaveBeenCalledWith(
            'cbl', '<xml>CBL</xml>'
          );
          expect(createConfigSpy).toHaveBeenCalledWith(
            'blamaste', '<xml>Blamaste</xml>'
          );
          expect(createConfigSpy).toHaveBeenCalledWith(
            'oblama', '<xml>oblama</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'bad-blammajamma', '<xml>bad-blamma-jamma</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'small-bets', '<xml>small-bets</xml>'
          );
        });
      }).then(function () {
        var pc = new PC({
          files: [
            'some/bad-blammajamma.xml',
          ],
          jenkinsServer: 'cactus.roving.com',
        });
        createConfigSpy.calls.reset();
        mockFs.readFileAsync.calls.reset();
        expect(mockFs.readFileAsync).not.toHaveBeenCalled();
        expect(createConfigSpy).not.toHaveBeenCalled();
        return pc.load().then(function () {
          expect(mockFs.readFileAsync).toHaveBeenCalled();
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'cactus', '<xml>Cactus</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'falcon', '<xml>Falcon</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'cbl', '<xml>CBL</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'blamaste', '<xml>Blamaste</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'oblama', '<xml>oblama</xml>'
          );
          expect(createConfigSpy).toHaveBeenCalledWith(
            'bad-blammajamma', '<xml>bad-blamma-jamma</xml>'
          );
          expect(createConfigSpy).not.toHaveBeenCalledWith(
            'small-bets', '<xml>small-bets</xml>'
          );
        });
      }).then(function () {
        done();
      });
    });
    it('it should not attempt to import files it cannot read from disk', function (done) {
      var pc = new PC({
        files: [
          '/buzz.foo',
          '/small-bets',
          'some/bad-blammajamma.xml',
        ],
        jenkinsServer: 'buzz.cactus.windmill',
      });
      createConfigSpy.calls.reset();
      expect(createConfigSpy).not.toHaveBeenCalled();
      pc.load().then(function () {
        expect(createConfigSpy).toHaveBeenCalledWith(
          'bad-blammajamma', '<xml>bad-blamma-jamma</xml>'
        );
        expect(createConfigSpy).not.toHaveBeenCalledWith(
          'buzz', '<xml>buzz</xml>'
        );
        expect(createConfigSpy).not.toHaveBeenCalledWith(
          'small-bets', '<xml>small-bets</xml>'
        );
        done();
      });
    });
    // TODO: Another test here that uses gondor / cactus / others as the example.
    // Testing to make sure it calsl create vs set config
  });
});
