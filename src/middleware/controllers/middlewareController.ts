import { Logger } from '@map-colonies/js-logger';
import { BoundCounter, Meter } from '@opentelemetry/api-metrics';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { IngestionPayload, UpdatePayload } from '../../common/interfaces';
import { MiddlewareManager } from '../models/middlewareManager';
import { StoreTriggerResponse } from '../../externalServices/storeTrigger/interfaces';
import { MetadataParams } from '../../externalServices/catalog/interfaces';

type CreateModelHandler = RequestHandler<undefined, StoreTriggerResponse, IngestionPayload>;
type UpdateMetadataHandler = RequestHandler<MetadataParams, unknown, UpdatePayload>;

@injectable()
export class MiddlewareController {
  private readonly createdResourceCounter: BoundCounter;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(MiddlewareManager) private readonly manager: MiddlewareManager,
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

  public updateMetadata: UpdateMetadataHandler = async (req, res, next) => {
    const { identifier } = req.params;
    try {
      const payload = req.body;
      const response = await this.manager.updateMetadata(identifier, payload);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({ msg: `Failed in updating the metadata!`, error });
      return next(error);
    }
  };
}
