import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/requestCall';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { CatalogCall } from '../../externalServices/catalog/requestCall';
import * as utils from './utilities';

@injectable()
export class MiddlewareManager {
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

  public async updateMetadata(identifier: string, payload: UpdatePayload): Promise<unknown> {
    this.logger.info({ msg: 'started update of metadata', modelId: identifier, payload });
    this.logger.debug({ msg: 'starting validating the payload', modelId: identifier });
    try {
      const validated: boolean | string = await this.validator.validateUpdate(identifier, payload);
      if (typeof validated == 'string') {
        throw new AppError('badRequest', httpStatus.BAD_REQUEST, validated, true);
      }
      this.logger.info({ msg: 'model validated successfully', modelId: identifier });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'unfamiliar error', error });
      throw new AppError('error', httpStatus.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.patchMetadata(identifier, payload);
      return response;
    } catch (error) {
      this.logger.error({ msg: 'Error while sending to catalog service', modelId: identifier, error, payload });
      throw new AppError('catalog', httpStatus.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }

  public async updateStatus(identifier: string, payload: UpdateStatusPayload): Promise<unknown> {
    this.logger.info({ msg: 'started update of metadata', modelId: identifier, payload });
    this.logger.debug({ msg: 'starting validating the payload', modelId: identifier });
    try {
      const validated: boolean | string = await this.validator.validateRecordExistence(identifier);
      if (typeof validated == 'string') {
        throw new AppError('badRequest', httpStatus.BAD_REQUEST, validated, true);
      }
      this.logger.info({ msg: 'model validated successfully', modelId: identifier });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'unfamiliar error', error });
      throw new AppError('error', httpStatus.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.changeStatus(identifier, payload);
      return response;
    } catch (error) {
      this.logger.error({ msg: 'Error while sending to catalog service', modelId: identifier, error, payload });
      throw new AppError('catalog', httpStatus.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }
}
