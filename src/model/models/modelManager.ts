import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { StatusCodes } from 'http-status-codes';
import { ProductType, RecordStatus } from '@map-colonies/mc-model-types';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/storeTriggerCall';
import { StoreTriggerIngestionPayload, StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { FILE_ENCODING, SERVICES } from '../../common/constants';
import { FailedReason, ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { IConfig, IngestionPayload, IngestionValidatePayload, LogContext, ValidationResponse } from '../../common/interfaces';
import { Record3D } from '../../externalServices/catalog/interfaces';
import { CatalogCall } from '../../externalServices/catalog/catalogCall';
import {
  convertStringToGeojson,
  changeBasePathToPVPath,
  replaceBackQuotesWithQuotes,
  removePvPathFromModelPath,
  convertPolygonTo2DPolygon,
} from './utilities';

export const ERROR_STORE_TRIGGER_ERROR: string = 'store-trigger service is not available';

@injectable()
export class ModelManager {
  private readonly basePath: string;
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(CatalogCall) private readonly catalog: CatalogCall,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(StoreTriggerCall) private readonly storeTrigger: StoreTriggerCall
  ) {
    this.logContext = {
      fileName: __filename,
      class: ModelManager.name,
    };
    this.basePath = this.config.get<string>('paths.basePath');
  }

  @withSpanAsyncV4
  public async validateModel(payload: IngestionValidatePayload): Promise<ValidationResponse> {
    const isValid = this.validator.isModelPathValid(payload.modelPath, this.basePath);
    if (!isValid) {
      return {
        isValid: false,
        message: `Unknown model path! The model isn't in the agreed folder!, modelPath: ${payload.modelPath}, basePath: ${this.basePath}`,
      };
    }

    const adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);
    const isModelFileExists = await this.validator.isPathExist(adjustedModelPath);
    if (!isModelFileExists) {
      return {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${adjustedModelPath}`,
      };
    }

    const tilesetLocation = join(adjustedModelPath, payload.tilesetFilename);
    const isTilesetExists = await this.validator.isPathExist(tilesetLocation);
    if (!isTilesetExists) {
      return {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
    }

    const fileContent: string = await readFile(tilesetLocation, { encoding: FILE_ENCODING });
    const failedReason: FailedReason = { outFailedReason: '' };
    const polygonResponse = this.validator.getTilesetModelPolygon(fileContent, failedReason);
    if (polygonResponse == undefined) {
      return {
        isValid: false,
        message: failedReason.outFailedReason,
      };
    }

    const sourcesValidationResponse: ValidationResponse = this.validator.isPolygonValid(polygonResponse);
    if (!sourcesValidationResponse.isValid) {
      return sourcesValidationResponse;
    }

    if (payload.metadata == undefined) {
      return {
        isValid: true,
      };
    }
    // else {
    const isMetadataValidResponse = await this.validator.isMetadataValid(payload.metadata, polygonResponse);
    return isMetadataValidResponse;
  }

  @withSpanAsyncV4
  public async deleteModel(recordId: string): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.deleteModel.name };
    this.logger.info({
      msg: `Delete model ${recordId} - validation start`,
      logContext,
      recordId,
    });

    const results = await this.catalog.findRecords({ id: recordId });
    if (results.length != 1) {
      throw new AppError('', StatusCodes.BAD_REQUEST, `RecordId doesn't match 1 existing record`, true);
    }

    const validationResult = this.validateDelete(results[0]);
    if (!validationResult.isValid) {
      throw new AppError('', StatusCodes.BAD_REQUEST, validationResult.message!, true);
    }

    this.logger.info({
      msg: 'new model ingestion - start delete',
      logContext,
      recordId,
    });

    const result = await this.storeTrigger.startDeleteJob({ modelId: results[0].id });
    // change catalog delete status
    this.logger.info({
      msg: `Delete Job for ${recordId} created successfuly, Set Record status to 'BEING_DELETED'`,
      logContext,
      recordId,
    });
    try {
      const newRecordStatus = await this.catalog.changeStatus(recordId, { productStatus: RecordStatus.BEING_DELETED });
      if (newRecordStatus.productStatus != RecordStatus.BEING_DELETED) {
        throw new AppError(
          'catalog',
          StatusCodes.INTERNAL_SERVER_ERROR,
          `Delete Job Created, But failed to change the record status to BEING_DELETED`,
          true
        );
      }
    } catch (err) {
      this.logger.error({
        msg: 'Failed to change the record status to BEING_DELETED in catalog service',
        logContext,
        recordId,
        err,
      });
      throw new AppError(
        'catalog',
        StatusCodes.INTERNAL_SERVER_ERROR,
        `Delete Job Created, But failed to change the record status to BEING_DELETED`,
        true
      );
    }
    return result;
  }

  @withSpanAsyncV4
  public async validateDeleteByRecordId(recordId: string): Promise<ValidationResponse> {
    const records = await this.catalog.findRecords({ id: recordId });
    if (records.length <= 0) {
      const validationResponse: ValidationResponse = {
        isValid: false,
        message: 'No record exists for that id',
      };
      return validationResponse;
    } else if (records.length > 1) {
      const validationResponse: ValidationResponse = {
        isValid: false,
        message: 'More than one record exists for that id',
      };
      return validationResponse;
    }
    // else
    return this.validateDelete(records[0]);
  }

  @withSpanAsyncV4
  public async createModel(payload: IngestionPayload): Promise<StoreTriggerResponse> {
    const logContext = { ...this.logContext, function: this.createModel.name };

    this.logger.info({
      msg: 'new model ingestion - start validation',
      logContext,
      modelName: payload.metadata.productName,
      payload,
    });

    // update values
    const originalModelPath: string = payload.modelPath;

    try {
      payload.metadata.footprint = convertStringToGeojson(JSON.stringify(payload.metadata.footprint));
      const isValidResponse = await this.validateModel(payload);
      if (!isValidResponse.isValid) {
        const validationMessage = isValidResponse.message!;
        this.logger.warn({
          msg: `new model ingestion - validation failed ${validationMessage}`,
          logContext,
          modelName: payload.metadata.productName,
        });
        throw new AppError('', StatusCodes.BAD_REQUEST, validationMessage, true);
      }
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      // else
      this.logger.error({
        msg: 'unfamiliar error',
        logContext,
        err,
      });
      throw new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, String(err), true);
    }

    // else
    const modelId = uuid();
    this.logger.info({
      msg: 'new model ingestion - start ingestion',
      logContext,
      modelId,
      modelName: payload.metadata.productName,
      payload,
    });
    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: modelId,
    });
    const adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);
    payload.metadata.footprint = convertPolygonTo2DPolygon(payload.metadata.footprint);
    const request: StoreTriggerIngestionPayload = {
      modelId: modelId,
      pathToTileset: removePvPathFromModelPath(adjustedModelPath),
      tilesetFilename: payload.tilesetFilename,
      metadata: { ...payload.metadata, productSource: originalModelPath },
    };
    try {
      const response: StoreTriggerResponse = await this.storeTrigger.startIngestion(request);
      return response;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      this.logger.error({
        msg: 'Error in creating a flow',
        logContext,
        modelId,
        modelName: payload.metadata.productName,
        err,
        payload,
      });
      throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, ERROR_STORE_TRIGGER_ERROR, true);
    }
  }

  private validateDelete(record: Record3D): ValidationResponse {
    if (record.productType != ProductType.PHOTO_REALISTIC_3D) {
      const validationResponse: ValidationResponse = {
        isValid: false,
        message: `Can't delete record that it's productType isn't "3DPhotoRealistic"`,
      };
      return validationResponse;
    }

    if (record.productStatus != RecordStatus.UNPUBLISHED) {
      const validationResponse: ValidationResponse = {
        isValid: false,
        message: `Can't delete record that it's productStatus isn't "UNPUBLISHED"`,
      };
      return validationResponse;
    }

    return {
      isValid: true,
    };
  }

  private getAdjustedModelPath(modelPath: string): string {
    const logContext = { ...this.logContext, function: this.getAdjustedModelPath.name };
    const changedModelPath = changeBasePathToPVPath(modelPath);
    const replacedModelPath = replaceBackQuotesWithQuotes(changedModelPath);
    this.logger.debug({
      msg: `changed model name from: '${modelPath}' to: '${replacedModelPath}'`,
      logContext,
      productSource: modelPath,
      replacedModelPath: replacedModelPath,
    });
    return replacedModelPath;
  }
}
