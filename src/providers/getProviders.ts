import config from 'config';
import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { AppError } from '../common/appError';
import { ProviderConfig } from '../common/interfaces';
import { S3Provider } from './s3Provider';

function getProvider(): S3Provider {
  return container.resolve(S3Provider);
}
function getProviderConfig(provider: string): ProviderConfig {
  try {
    return config.get(provider);
  } catch (err) {
    throw new AppError(
      'configError',
      StatusCodes.INTERNAL_SERVER_ERROR,
      `Invalid config provider received: ${provider} - available values: "nfs" or "s3"`,
      false
    );
  }
}

export { getProvider, getProviderConfig };
