import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { DeleteRequest } from '../catalog/interfaces';
import { StoreTriggerResponse, StoreTriggerConfig, StoreTriggerPayload } from './interfaces';

@injectable()
export class StoreTriggerCall {
  private readonly storeTrigger: StoreTriggerConfig;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.storeTrigger = this.config.get<StoreTriggerConfig>('storeTrigger');
  }

  public async postPayload(payload: StoreTriggerPayload): Promise<StoreTriggerResponse> {
    this.logger.debug({
      msg: 'sending the ingestion request to store-trigger',
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      flowPayload: payload,
    });
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger.url}/ingestion`, payload);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      jobId: response.data.jobID,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    return response.data;
  }

  public async deleteModel(request: DeleteRequest): Promise<StoreTriggerResponse> {
    this.logger.info({
      msg: 'sending the delete request to store-trigger',
      modelId: request.modelId,
      modelLink: request.modelLink,
    });
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger.url}/deleting`, request);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      jobId: response.data.jobID,
      modelId: request.modelId,
      modelLink: request.modelLink,
      request,
    });
    return response.data;
  }
}
