import jsLogger from '@map-colonies/js-logger';
import { randFileExt, randWord } from '@ngneat/falso';
import { container } from 'tsyringe';
import config from 'config';
import { S3Config } from '../../../src/common/interfaces';
import { S3Helper } from '../../helpers/s3Helper';
import { SERVICES } from '../../../src/common/constants';
import { getApp } from '../../../src/app';
import { S3Provider } from '../../../src/common/providers/s3Provider';

jest.useFakeTimers();

describe('S3Provider', () => {
  let provider: S3Provider;
  let s3Helper: S3Helper;

  const s3Config = config.get<S3Config>('S3');

  beforeAll(() => {
    getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.PROVIDER_CONFIG, provider: { useValue: s3Config } },
      ],
    });
    provider = container.resolve(S3Provider);
    s3Helper = container.resolve(S3Helper);
  });

  beforeEach(async () => {
    await s3Helper.initialize();
  });

  afterEach(async () => {
    await s3Helper.terminate();
    jest.clearAllMocks();
  });

  describe('getFile', () => {
    it(`When calling getFile, should see the file content from source bucket`, async () => {
      const model = randWord();
      const file = `${randWord()}.${randFileExt()}`;
      const expected = await s3Helper.createFileOfModel(model, file);

      const result = await provider.getFile(`${model}/${file}`);

      expect(result).toStrictEqual(expected);
    });
  });
});
