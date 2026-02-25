import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { Tracer } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { SERVICES } from '../../common/constants';
import { AppError } from '../../common/appError';
import { IConfig, LogContext } from '../../common/interfaces';

@injectable()
export class ExtractableCall {
  private readonly logContext: LogContext;
  private readonly extractable: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer
  ) {
    this.extractable = this.config.get<string>('externalServices.extractable');
    this.logContext = {
      fileName: __filename,
      class: ExtractableCall.name,
    };
  }

  @withSpanAsyncV4
  public async isExtractableRecordExists(recordName: string): Promise<boolean> {
    const logContext = { ...this.logContext, function: this.isExtractableRecordExists.name };
    this.logger.debug({ msg: `Checking record '${recordName}' in extractable service`, logContext });

    try {
      const response = await axios.get(`${this.extractable}/records/${recordName}`, {
        validateStatus: () => true,
      });

      if (response.status === StatusCodes.OK) {
        this.logger.debug({ msg: `Record '${recordName}' exists in extractable`, logContext });
        return true;
      }

      if (response.status === StatusCodes.NOT_FOUND) {
        this.logger.debug({ msg: `Record '${recordName}' does not exist in extractable`, logContext });
        return false;
      }

      this.logger.error({ msg: `Unexpected status from extractable: ${response.status}`, logContext, status: response.status });

      throw new AppError('extractable', StatusCodes.INTERNAL_SERVER_ERROR, 'Unexpected response from extractable service', true);
    } catch (error) {
      this.logger.error({ msg: 'Error occurred during isExtractableRecordExists call', recordName, logContext, err: error });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('extractable', StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to query extractable service', true);
    }
  }
}
