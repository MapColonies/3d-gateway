import axios, { AxiosError } from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from '../../common/constants';
import { IConfig, LogContext } from '../../common/interfaces';
import { AppError } from '../../common/appError';
import { StoreTriggerResponse, StoreTriggerIngestionPayload, StoreTriggerDeletePayload } from './interfaces';

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
  public async startDeleteJob(payload: StoreTriggerDeletePayload): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.startDeleteJob.name };
    this.logger.debug({
      msg: 'got a request for a new delete flow',
      logContext,
      modelId: payload.modelId,
    });
    try {
      const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger}/delete`, payload);
      this.logger.info({
        msg: 'sent delete to store-trigger successfully',
        logContext,
        jobId: response.data.jobId,
        modelId: payload.modelId,
      });
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == StatusCodes.BAD_REQUEST) {
        const error: AxiosError = err;
        const dataMesage: { message?: string } | undefined = error.response?.data as { message?: string } | undefined;
        const message = dataMesage?.message ?? err.message;
        this.logger.error({
          msg: 'Error when calling to store trigger to create a delete job',
          logContext,
          modelId: payload.modelId,
          err,
        });
        throw new AppError('error', StatusCodes.BAD_REQUEST, message, true);
      }
      throw err;
    }
  }

  @withSpanAsyncV4
  public async startIngestion(payload: StoreTriggerIngestionPayload): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.startIngestion.name };
    this.logger.debug({
      msg: 'got a request for a new Ingestion flow',
      logContext,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      flowPayload: payload,
    });
    try {
      const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger}/ingestion`, payload);
      this.logger.info({
        msg: 'sent Ingestion to store-trigger successfully',
        logContext,
        jobId: response.data.jobId,
        modelId: payload.modelId,
        modelName: payload.metadata.productName,
        payload,
      });
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == StatusCodes.BAD_REQUEST) {
        const error: AxiosError = err;
        const dataMesage: { message?: string } | undefined = error.response?.data as { message?: string } | undefined;
        const message = dataMesage?.message ?? err.message;
        this.logger.error({
          msg: 'Error when calling to store trigger to create an Ingestion job',
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
