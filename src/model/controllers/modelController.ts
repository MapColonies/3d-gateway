import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, LogContext } from '../../common/interfaces';
import { ModelManager } from '../models/modelManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';

type CreateModelHandler = RequestHandler<undefined, undefined, IngestionPayload>;

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
      return res.status(StatusCodes.CREATED).json();
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
}
