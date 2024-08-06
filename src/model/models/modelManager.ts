import { join } from 'node:path';
import { inject, injectable } from 'tsyringe';
import { v4 as uuid } from 'uuid';
import { Logger } from '@map-colonies/js-logger';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer, trace } from '@opentelemetry/api';
import { THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { StatusCodes } from 'http-status-codes';
import { StoreTriggerCall } from '../../externalServices/storeTrigger/storeTriggerCall';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { SERVICES } from '../../common/constants';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { IngestionPayload, IngestionSourcesPayload, LogContext, ValidationResponse } from '../../common/interfaces';
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
  public async validateModelSources(payload: IngestionSourcesPayload): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.validateModelSources.name };
    this.logger.info({
      msg: 'Sources validation started',
      logContext,
      payload,
    });

    if (payload.adjustedModelPath == undefined) {
      payload.adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);
    }

    const resultModelPathValidation = this.validator.validateModelPath(payload.modelPath);
    if (typeof resultModelPathValidation === 'string') {
      return {
        isValid: false,
        message: resultModelPathValidation,
      };
    }
    const tilesetLocation = join(payload.adjustedModelPath, payload.tilesetFilename);
    const sourcesValidationResponse = await this.validator.sourcesValid(payload, tilesetLocation);

    this.logger.info({
      msg: 'Sources validation ended',
      logContext,
      payload,
      sourcesValidationResponse,
    });
    return sourcesValidationResponse;
  }

  @withSpanAsyncV4
  public async validateModel(payload: IngestionPayload): Promise<ValidationResponse> {
    const logContext = { ...this.logContext, function: this.validateModel.name };
    this.logger.info({
      msg: 'model validation started',
      logContext,
      modelName: payload.metadata.productName,
      payload,
    });

    if (payload.adjustedModelPath == undefined) {
      payload.adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);
    }

    const isSourcesValidResponse = await this.validateModelSources({ modelPath: payload.modelPath, tilesetFilename: payload.tilesetFilename });
    if (!isSourcesValidResponse.isValid) {
      this.logger.info({
        msg: 'model validation ended',
        logContext,
        modelName: payload.metadata.productName,
        payload,
        isSourcesValidResponse,
      });
      return isSourcesValidResponse;
    }

    const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
    const isMetadataValidResponse = await this.validator.isMetadataValid(payload, tilesetLocation);
    this.logger.info({
      msg: 'model validation ended',
      logContext,
      modelName: payload.metadata.productName,
      payload,
      isSourcesValidResponse,
    });
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
    payload.metadata.footprint = convertStringToGeojson(JSON.stringify(payload.metadata.footprint));
    payload.adjustedModelPath = this.getAdjustedModelPath(payload.modelPath);

    try {
      const isValidResponse = await this.validateModel(payload);
      if (!isValidResponse.isValid) {
        throw new AppError('', StatusCodes.BAD_REQUEST, isValidResponse.message!, true);
      }
    } catch (error) {
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
