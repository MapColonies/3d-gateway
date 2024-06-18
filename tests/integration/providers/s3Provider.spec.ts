import jsLogger from '@map-colonies/js-logger';
import { faker } from '@faker-js/faker';
import { container } from 'tsyringe';
import config from 'config';
import { S3Config } from '../../../src/common/interfaces';
import { S3Helper } from '../../helpers/s3Helper';
import { SERVICES } from '../../../src/common/constants';
import { getApp } from '../../../src/app';
import { S3Provider } from '../../../src/providers/s3Provider';

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
    s3Helper = new S3Helper(s3Config);
  });

  beforeEach(async () => {
    await s3Helper.initialize();
  });

  afterEach(async () => {
    await s3Helper.terminate();
    jest.clearAllMocks();
  });

  describe('getFile', () => {
    it(`Should get the file when it exists on the bucket`, async () => {
      const filePath = `${faker.word.sample()}/${faker.word.sample()}.${faker.system.commonFileExt()}`;
      const expected = (await s3Helper.createFile(filePath)).toString();

      const result = await provider.getFile(filePath);

      expect(result).toStrictEqual(expected);
    });

    it(`Should throw an error when file does not exists`, async () => {
      const filePath = `${faker.word.sample()}/${faker.word.sample()}.${faker.system.commonFileExt()}`;

      const result = provider.getFile(filePath);

      await expect(result).rejects.toThrow('NoSuchKey: The specified key does not exist.');
    });
  });
});
