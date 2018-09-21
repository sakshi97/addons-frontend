import path from 'path';

import fs from 'fs-extra';
import MockExpressResponse from 'mock-express-response';

import {
  getFeatureFlagName,
  viewFrontendVersionHandler,
} from 'core/utils/server';
import { getFakeConfig } from 'tests/unit/helpers';

describe(__filename, () => {
  describe('viewFrontendVersionHandler', () => {
    const basePath = path.join(__dirname, '__fixtures__');
    const versionJson = fs.readJsonSync(path.join(basePath, 'version.json'));

    it('exposes the version.json file', (done) => {
      const _config = getFakeConfig({ basePath });
      const handler = viewFrontendVersionHandler({ _config });

      const res = new MockExpressResponse();
      handler(null, res);

      res.on('finish', () => {
        expect(res.statusCode).toEqual(200);
        expect(res.get('content-type')).toEqual(
          'application/json; charset=utf-8',
        );
        expect(res._getJSON()).toMatchObject(versionJson);

        done();
      });
    });

    it('exposes the experiments and feature flags', (done) => {
      const experiments = {
        ab_test_1: true,
      };
      const featureFlags = {
        enableShinyFeature: true,
        enableSomethingElse: false,
      };

      const _config = getFakeConfig(
        { basePath, experiments, ...featureFlags },
        true, // force unknow keys
      );
      const handler = viewFrontendVersionHandler({ _config });

      const res = new MockExpressResponse();
      handler(null, res);

      res.on('finish', () => {
        expect(res._getJSON()).toMatchObject({
          ...versionJson,
          experiments,
          feature_flags: {
            [getFeatureFlagName(
              'enableShinyFeature',
            )]: featureFlags.enableShinyFeature,
            [getFeatureFlagName(
              'enableSomethingElse',
            )]: featureFlags.enableSomethingElse,
          },
        });

        done();
      });
    });

    it('returns a 415 and logs an error when file does not exist', (done) => {
      const _config = getFakeConfig({ basePath: '/some/invalid/path' });
      const _log = {
        error: sinon.stub(),
      };

      const handler = viewFrontendVersionHandler({ _config, _log });

      const res = new MockExpressResponse();
      handler(null, res);

      res.on('finish', () => {
        expect(res.statusCode).toEqual(415);
        sinon.assert.calledOnce(_log.error);

        done();
      });
    });
  });
});
