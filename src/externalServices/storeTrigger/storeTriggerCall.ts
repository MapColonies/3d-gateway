import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from '../../common/constants';
import { IConfig, LogContext } from '../../common/interfaces';
import { AppError } from '../../common/appError';
import { StoreTriggerResponse, StoreTriggerPayload } from './interfaces';

@injectable()
export class StoreTriggerCall {
  private readonly logContext: LogContext;
  private readonly storeTrigger: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {
    this.storeTrigger = this.config.get<string>('externalServices.storeTrigger');
    this.logContext = {
      fileName: __filename,
      class: StoreTriggerCall.name,
    };
  }

  @withSpanAsyncV4
  public async postPayload(payload: StoreTriggerPayload): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.postPayload.name };
    this.logger.debug({
      msg: 'got a request for a new flow',
      logContext,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      flowPayload: payload,
    });
    try {
      const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger}/ingestion`, payload);
      this.logger.info({
        msg: 'sent to store-trigger successfully',
        logContext,
        jobId: response.data.jobId,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
        payload,
      });
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == StatusCodes.BAD_REQUEST) {
        const dataMesage = (err.response.data as { message: string }).message;
        const message = dataMesage ? dataMesage : err.message;
        this.logger.error({
          msg: 'Error when calling to store trigger to create the job',
          logContext,
          modelId: payload.modelId,
          modelName: payload.metadata.productName,
          err,
          payload,
        });
        throw new AppError('error', StatusCodes.BAD_REQUEST, message, true);
      }
      throw err;
    }
  }
}
