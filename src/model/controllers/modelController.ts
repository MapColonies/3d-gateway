import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, MetadataParams } from '../../common/interfaces';
import { ModelManager } from '../models/modelManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';

type CreateModelHandler = RequestHandler<undefined, StoreTriggerResponse, IngestionPayload>;
type DeleteModelHandler = RequestHandler<MetadataParams, StoreTriggerResponse, string>;

@injectable()
export class ModelController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ModelManager) private readonly manager: ModelManager,
    @inject(SERVICES.METER) private readonly meter: Meter
  ) {
    this.createdResourceCounter = meter.createCounter('created_resource');
  }

  public createModel: CreateModelHandler = async (req, res, next) => {
    try {
      const payload = req.body;
      const response = await this.manager.createModel(payload);
      this.createdResourceCounter.add(1);
      return res.status(httpStatus.CREATED).json(response);
    } catch (error) {
      this.logger.error({ msg: `Failed in ingesting a new model!`, error, modelName: req.body.metadata.productName });
      return next(error);
    }
  };

  public deleteModel: DeleteModelHandler = async (req, res, next) => {
    try {
      const { identifier } = req.params;
      const response = await this.manager.deleteModel(identifier);
      return res.set(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({ msg: `Couldn't delete a record`, error });
      return next(error);
    }
  };
}
