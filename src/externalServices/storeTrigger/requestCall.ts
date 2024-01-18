import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from '../../common/constants';
import { IConfig } from '../../common/interfaces';
import { StoreTriggerDeletePayload } from '.././storeTrigger/interfaces';
import { StoreTriggerResponse, StoreTriggerConfig, StoreTriggerIngestionPayload } from './interfaces';

@injectable()
export class StoreTriggerCall {
  private readonly storeTrigger: StoreTriggerConfig;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.storeTrigger = this.config.get<StoreTriggerConfig>('storeTrigger');
  }

  public async postPayload(payload: StoreTriggerIngestionPayload): Promise<StoreTriggerResponse> {
    this.logger.debug({
      msg: 'sending the ingestion request to store-trigger',
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      flowPayload: payload,
    });
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger.url}/jobs/ingestion`, payload);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      jobId: response.data.jobID,
      modelId: payload.modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    return response.data;
  }

  public async deletePayload(request: StoreTriggerDeletePayload): Promise<StoreTriggerResponse> {
    this.logger.debug({
      msg: 'sending the delete request to store-trigger',
      modelId: request.modelId,
      pathToTileset: request.pathToTileset,
      modelName: request.modelName,
    });
    const response = await axios.post<StoreTriggerResponse>(`${this.storeTrigger.url}/jobs/delete`, request);
    this.logger.info({
      msg: 'sent to store-trigger successfully',
      jobId: response.data.jobID,
      modelId: request.modelId,
      pathToTileset: request.pathToTileset,
      modelName: request.modelName,
      request,
    });
    return response.data;
  }
}
