import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { RecordStatus } from '@map-colonies/mc-model-types';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/requestCall';
import { StoreTriggerPayload, StoreTriggerResponse, DeleteRequest } from '../../externalServices/storeTrigger/interfaces';
import { SERVICES } from '../../common/constants';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { IngestionPayload } from '../../common/interfaces';
import { CatalogCall } from '../../externalServices/catalog/requestCall';
import { Record3D } from '../../externalServices/catalog/interfaces';
import * as utils from './utilities';

@injectable()
export class ModelManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(StoreTriggerCall) private readonly storeTrigger: StoreTriggerCall,
    @inject(CatalogCall) private readonly catalog: CatalogCall
  ) {}

  public async createModel(payload: IngestionPayload): Promise<StoreTriggerResponse> {
    const modelId = uuid();
    this.logger.info({ msg: 'started ingestion of new model', modelId, modelName: payload.metadata.productName, payload });
    const productSource: string = payload.modelPath;
    payload.metadata.footprint = utils.convertStringToGeojson(JSON.stringify(payload.metadata.footprint));

    this.logger.debug({ msg: 'starting validating the payload', modelId, modelName: payload.metadata.productName });
    try {
      const resultModelPathValidation = this.validator.validateModelPath(payload.modelPath);
      if (typeof resultModelPathValidation === 'string') {
        throw new AppError('', httpStatus.BAD_REQUEST, resultModelPathValidation, true);
      }
      payload.modelPath = utils.changeBasePathToPVPath(payload.modelPath);
      payload.modelPath = utils.replaceBackQuotesWithQuotes(payload.modelPath);
      this.logger.debug({ msg: `changed model name from: '${productSource}' to: '${payload.modelPath}'`, modelName: payload.metadata.productName });

      const validated: boolean | string = await this.validator.validateIngestion(payload);
      if (typeof validated == 'string') {
        throw new AppError('badRequest', httpStatus.BAD_REQUEST, validated, true);
      }
      this.logger.info({ msg: 'model validated successfully', modelId, modelName: payload.metadata.productName });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'unfamiliar error', error });
      throw new AppError('error', httpStatus.INTERNAL_SERVER_ERROR, String(error), true);
    }

    const request: StoreTriggerPayload = {
      modelId: modelId,
      pathToTileset: utils.removePvPathFromModelPath(payload.modelPath),
      tilesetFilename: payload.tilesetFilename,
      metadata: { ...payload.metadata, productSource: productSource },
    };
    try {
      const response: StoreTriggerResponse = await this.storeTrigger.postPayload(request);
      return response;
    } catch (error) {
      this.logger.error({ msg: 'Error in creating a flow', modelId, modelName: payload.metadata.productName, error, payload });
      throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true);
    }
  }

  public async deleteModel(identifier: string): Promise<StoreTriggerResponse> {
    this.logger.debug({ msg: 'delete record', modelId: identifier });
    const record: Record3D | undefined = await this.catalog.getRecord(identifier);
    try {
      if (record === undefined) {
        this.logger.error({ msg: 'model identifier not found', modelId: identifier });
        throw new AppError('NOT_FOUND', httpStatus.NOT_FOUND, `Identifier ${identifier} wasn't found on DB`, true);
      }
      if (record.productStatus != RecordStatus.UNPUBLISHED) {
        this.logger.error({ msg: 'got UNPUBLISHED model', modelId: identifier });
        throw new AppError(
          'BAD_REQUEST',
          httpStatus.BAD_REQUEST,
          `Model ${record.productName} is PUBLISHED. The model must be UNPUBLISHED to be deleted!`,
          true
        );
      }
      this.logger.info({ msg: 'starting deleting record', modelId: identifier, modelName: record.productName });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
    }
    if (record === undefined) {
      throw new AppError('NOT_FOUND', httpStatus.NOT_FOUND, `Identifier ${identifier} wasn't found on DB`, true);
    } else {
      const request: DeleteRequest = {
        modelId: identifier,
        modelLink: record.links,
      };
      try {
        const response: StoreTriggerResponse = await this.storeTrigger.deletePayload(request);
        return response;
      } catch (error) {
        this.logger.error({ msg: 'Error in creating flow', identifier, modelName: record.producerName, error, record });
        throw new AppError('', httpStatus.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true);
      }
    }
  }
}
