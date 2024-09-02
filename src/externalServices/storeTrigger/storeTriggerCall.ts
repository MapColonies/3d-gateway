import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { SERVICES } from '../../common/constants';
import { LogContext } from '../../common/interfaces';
import { ConfigType } from '../../common/config';
import { StoreTriggerResponse, StoreTriggerPayload } from './interfaces';

@injectable()
export class StoreTriggerCall {
  private readonly logContext: LogContext;
  private readonly storeTrigger: string;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {
    this.storeTrigger = this.config.get('externalServices.storeTrigger');
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
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger}/ingestion`, payload);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      logContext,
      jobId: response.data.jobID,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    return response.data;
  }
}
