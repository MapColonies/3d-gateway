import config from 'config';
import { StatusCodes } from 'http-status-codes';
import { faker } from '@faker-js/faker';
import { AppError } from '../../../src/common/appError';
import { S3Config } from '../../../src/common/interfaces';
import { getProvider, getProviderConfig } from '../../../src/providers/getProviders';

describe('getProviderConfig tests', () => {
  it('should return the S3 config when the provider is S3', () => {
    const provider = 'S3';
    const expected = config.get<S3Config>('S3');

    const response = getProviderConfig(provider);

    expect(response).toStrictEqual(expected);
  });

  it(`should throw an error when the provider can't be found on config`, () => {
    const provider = faker.word.sample();

    const response = () => getProviderConfig(provider);

    expect(response).toThrow(
      new AppError(
        'configError',
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Invalid config provider received: ${provider} - available values: "nfs" or "s3"`,
        false
      )
    );
  });
});

describe('getProvider tests', () => {
  it('should throw an error when the provider is not S3', () => {
    const response = () => getProvider();

    expect(response).toThrow(Error);
  });
});
