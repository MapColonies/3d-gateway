import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, IngestionSourcesPayload, LogContext, ValidationResponse } from '../../common/interfaces';
import { ModelManager } from '../models/modelManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';

type CreateModelHandler = RequestHandler<undefined, StoreTriggerResponse, IngestionPayload>;
type ValidateSourcesHandler = RequestHandler<undefined, ValidationResponse, IngestionSourcesPayload>;
type ValidateModelHandler = RequestHandler<undefined, ValidationResponse, IngestionPayload>;

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
      const response = await this.manager.createModel(payload);
      return res.status(StatusCodes.CREATED).json(response);
    } catch (error) {
      this.logger.error({
        msg: `Failed in ingesting a new model!`,
        logContext,
        error,
        modelName: req.body.metadata.productName,
      });
      return next(error);
    }
  };

  public validateSources: ValidateSourcesHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.validateSources.name };
    try {
      const payload = req.body;
      const response = await this.manager.validateModelSources(payload);
      if (!response.isValid) {
        return res.status(StatusCodes.BAD_REQUEST).json(response);
      } else {
        return res.status(StatusCodes.OK).json(response);
      }
    } catch (error) {
      this.logger.error({
        msg: `Failed to validate sources!`,
        logContext,
        error,
        modelPath: req.body.modelPath,
        tilesetFilename: req.body.tilesetFilename,
      });
      return next(error);
    }
  };

  public validate: ValidateModelHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.validate.name };
    try {
      const payload = req.body;
      const response = await this.manager.validateModel(payload);
      return res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.logger.error({
        msg: `Failed to validate model!`,
        logContext,
        error,
        modelName: req.body.metadata.productName,
      });
      return next(error);
    }
  };
}
