import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { GetObjectCommandInput, GetObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { StatusCodes } from 'http-status-codes';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { SERVICES } from '../common/constants';
import { Provider, S3Config } from '../common/interfaces';
import { AppError } from '../common/appError';

@injectable()
export class S3Provider implements Provider {
  private readonly s3: S3Client;

  public constructor(
    @inject(SERVICES.PROVIDER_CONFIG) protected readonly s3Config: S3Config,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    const s3ClientConfig: S3ClientConfig = {
      endpoint: this.s3Config.endpointUrl,
      forcePathStyle: this.s3Config.forcePathStyle,
      credentials: {
        accessKeyId: this.s3Config.accessKeyId,
        secretAccessKey: this.s3Config.secretAccessKey,
      },
      region: this.s3Config.region,
      maxAttempts: this.s3Config.maxAttempts,
      tls: this.s3Config.sslEnabled,
    };
    this.s3 = new S3Client(s3ClientConfig);
  }

  @withSpanAsyncV4
  public async getFile(filePath: string): Promise<string> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: GetObjectCommandInput = {
      Bucket: this.s3Config.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting getFile', filePath });
    try {
      const response = await this.s3.send(new GetObjectCommand(getParams));
      return await response.Body!.transformToString();
    } catch (error) {
      this.logger.error({ mag: 'Problem during get file from S3', bucket: this.s3Config.bucket, path: filePath, error });
      throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, String(error), true);
    }
  }
}
