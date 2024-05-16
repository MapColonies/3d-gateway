import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { StoreTriggerResponse, StoreTriggerPayload } from './interfaces';

@injectable()
export class StoreTriggerCall {
  private readonly storeTrigger: string;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.storeTrigger = this.config.get<string>('externalServices.storeTrigger');
  }

  public async postPayload(payload: StoreTriggerPayload): Promise<StoreTriggerResponse> {
    this.logger.debug({
      msg: 'got a request for a new flow',
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      flowPayload: payload,
    });
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger}/ingestion`, payload);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      jobId: response.data.jobID,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    return response.data;
  }
}
