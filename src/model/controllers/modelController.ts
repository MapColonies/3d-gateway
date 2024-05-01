import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload } from '../../common/interfaces';
import { ModelManager } from '../models/modelManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';

type CreateModelHandler = RequestHandler<undefined, StoreTriggerResponse, IngestionPayload>;

@injectable()
export class ModelController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ModelManager) private readonly manager: ModelManager,
  ) {}

  public createModel: CreateModelHandler = async (req, res, next) => {
    try {
      const payload = req.body;
      const response = await this.manager.createModel(payload);
      return res.status(httpStatus.CREATED).json(response);
    } catch (error) {
      this.logger.error({ msg: `Failed in ingesting a new model!`, error, modelName: req.body.metadata.productName });
      return next(error);
    }
  };
}
