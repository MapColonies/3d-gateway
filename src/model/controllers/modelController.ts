import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, IngestionValidatePayload, LogContext, ValidationResponse } from '../../common/interfaces';
import { ModelManager } from '../models/modelManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { getSimplifiedProductName } from '../models/utilities';
import { MetadataParams } from '../../externalServices/catalog/interfaces';

type CreateModelHandler = RequestHandler<undefined, StoreTriggerResponse, IngestionPayload>;
type ValidateModelHandler = RequestHandler<undefined, ValidationResponse, IngestionValidatePayload>;
type DeleteModelHandler = RequestHandler<MetadataParams, StoreTriggerResponse, undefined>;
type CanDeleteModelHandler = RequestHandler<MetadataParams, ValidationResponse, undefined>;

@injectable()
export class ModelController {
  private readonly logContext: LogContext;
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(ModelManager) private readonly manager: ModelManager) {
    this.logContext = {
      fileName: __filename,
      class: ModelController.name,
    };
  }

  public createModel: CreateModelHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.createModel.name };
    try {
      const payload = req.body;
      if (payload.metadata.productName != undefined) {
        payload.metadata.productName = getSimplifiedProductName(payload.metadata.productName);
      }
      const response = await this.manager.createModel(payload);
      return res.status(StatusCodes.CREATED).json(response);
    } catch (err) {
      this.logger.error({
        msg: `Failed in ingesting a new model!`,
        logContext,
        err,
        modelName: req.body.metadata.productName,
      });
      return next(err);
    }
  };

  public deleteModel: DeleteModelHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.deleteModel.name };
    const { identifier } = req.params;
    try {
      const response = await this.manager.deleteModel(identifier);
      return res.status(StatusCodes.OK).json(response);
    } catch (err) {
      this.logger.error({
        msg: `Failed in deleting model!`,
        logContext,
        err,
        identifier,
      });
      return next(err);
    }
  };

  public validateDeleteById: CanDeleteModelHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.validateDeleteById.name };
    const { identifier } = req.params;
    try {
      const response = await this.manager.validateDeleteByRecordId(identifier);
      return res.status(StatusCodes.OK).json(response);
    } catch (err) {
      this.logger.error({
        msg: `Failed to validate delete`,
        logContext,
        err,
        identifier,
      });
      return next(err);
    }
  };

  public validate: ValidateModelHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.validate.name };
    const payload = req.body;
    try {
      this.logger.info({
        msg: 'model validate started',
        logContext,
        payload,
      });

      if (payload.metadata?.productName != undefined) {
        payload.metadata.productName = getSimplifiedProductName(payload.metadata.productName);
      }

      const response = await this.manager.validateModelForIngestion(payload);
      this.logger.info({
        msg: 'model validate ended',
        logContext,
        payload,
        validateResponse: response,
      });
      return res.status(StatusCodes.OK).json(response);
    } catch (err) {
      this.logger.error({
        msg: `model validate failed!`,
        logContext,
        err,
        payload,
      });
      return next(err);
    }
  };
}
