import { Logger } from '@map-colonies/js-logger';
import { S3 } from 'aws-sdk';
import { inject, injectable } from 'tsyringe';
import { GetObjectCommandInput, GetObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { SERVICES } from '../constants';
import { Provider, S3Config } from '../interfaces';

@injectable()
export class S3Provider implements Provider {
  private readonly s3: S3Client;

  public constructor(
    @inject(SERVICES.PROVIDER_CONFIG) protected readonly s3Config: S3Config,
    @inject(SERVICES.LOGGER) protected readonly logger: Logger
  ) {
    this.s3 = this.createS3Instance(s3Config);
  }
  public async getFile(filePath: string): Promise<Buffer> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const getParams: GetObjectCommandInput = {
      Bucket: this.s3Config.bucket,
      Key: filePath,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    this.logger.debug({ msg: 'Starting getFile', filePath });
    const response = await this.s3.send(new GetObjectCommand(getParams));

    return response.Body?.transformToString() as unknown as Buffer;
  }

  private createS3Instance(config: S3Config): S3Client {
    return new S3Client({
      endpoint: config.endpointUrl,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      region: config.region,
      maxAttempts: config.maxAttempts,
      tls: config.tls,
      forcePathStyle: config.forcePathStyle,
    });
  }
}
