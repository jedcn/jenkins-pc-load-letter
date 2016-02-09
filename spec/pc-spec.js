var rewire = require('rewire');
var PC = rewire('../lib/pc');
var Promise = require('bluebird');

describe('Paper Cassette', function () {
  var mockFs = {
    writeFileAsync: jasmine.createSpy().and.callFake(function () {
      return true;
    }),
  };

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
        config: function (jobName) {
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
});
