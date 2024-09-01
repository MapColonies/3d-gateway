import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { StatusCodes } from 'http-status-codes';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/storeTriggerCall';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { FILE_ENCODING, SERVICES } from '../../common/constants';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { IngestionPayload, IngestionValidatePayload, LogContext, ValidationResponse } from '../../common/interfaces';
import { convertStringToGeojson, changeBasePathToPVPath, replaceBackQuotesWithQuotes, removePvPathFromModelPath } from './utilities';

@injectable()
export class ModelManager {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(StoreTriggerCall) private readonly storeTrigger: StoreTriggerCall
  ) {
    this.logContext = {
      fileName: __filename,
      class: ModelManager.name,
    };
  }

  @withSpanAsyncV4
  public async validateModel(payload: IngestionValidatePayload): Promise<ValidationResponse> {
    const resultModelPathValidation = this.validator.validateModelPath(payload.modelPath);
    if (typeof resultModelPathValidation === 'string') {
      return {
        isValid: false,
        message: resultModelPathValidation,
      };
    }

    const adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);
    const isModelFileExists = await this.validator.validateExist(adjustedModelPath);
    if (!isModelFileExists) {
      return {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${adjustedModelPath}`,
      };
    }

    const tilesetLocation = join(adjustedModelPath, payload.tilesetFilename);
    const isTilesetExists = await this.validator.validateExist(tilesetLocation);
    if (!isTilesetExists) {
      return {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
    }

    const fileContent: string = await readFile(tilesetLocation, { encoding: FILE_ENCODING });
    const polygonResponse = this.validator.getTilesetModelPolygon(fileContent);
    if (typeof polygonResponse == 'string') {
      return {
        isValid: false,
        message: polygonResponse,
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
        throw new AppError('', StatusCodes.BAD_REQUEST, isValidResponse.message!, true);
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
       // else
      this.logger.error({
        msg: 'unfamiliar error',
        logContext,
        error,
      });
      throw new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, String(error), true);
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

    const request: StoreTriggerPayload = {
      modelId: modelId,
      pathToTileset: removePvPathFromModelPath(payload.modelPath),
      tilesetFilename: payload.tilesetFilename,
      metadata: { ...payload.metadata, productSource: originalModelPath },
    };
    try {
      const response: StoreTriggerResponse = await this.storeTrigger.postPayload(request);
      return response;
    } catch (error) {
      this.logger.error({
        msg: 'Error in creating a flow',
        logContext,
        modelId,
        modelName: payload.metadata.productName,
        error,
        payload,
      });
      throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true);
    }
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
