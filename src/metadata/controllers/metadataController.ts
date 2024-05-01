import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';
import { MetadataManager } from '../models/metadataManager';
import { MetadataParams } from '../../externalServices/catalog/interfaces';

type UpdateMetadataHandler = RequestHandler<MetadataParams, unknown, UpdatePayload>;
type UpdateStatusHandler = RequestHandler<MetadataParams, unknown, UpdateStatusPayload>;

@injectable()
export class MetadataController {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(MetadataManager) private readonly manager: MetadataManager,
  ) {}

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

  public updateStatus: UpdateStatusHandler = async (req, res, next) => {
    const { identifier } = req.params;
    try {
      const payload = req.body;
      const response = await this.manager.updateStatus(identifier, payload);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({ msg: `Failed in changing the status!`, error });
      return next(error);
    }
  };
}
