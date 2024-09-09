import { StatusCodes } from 'http-status-codes';
import { container } from 'tsyringe';
import { AppError } from '../common/appError';
import { S3Provider } from './s3Provider';

function getProvider(provider: "NFS" | "S3"): S3Provider {
  switch (provider) {
    case 'NFS':
      throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'Service does not support NFS as provider yet!', false);
      // return container.resolve(NFSProvider);
    case 'S3':
      return container.resolve(S3Provider);
  }
}

export { getProvider };
