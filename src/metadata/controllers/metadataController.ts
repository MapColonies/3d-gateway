import { Logger } from '@map-colonies/js-logger';
import { RequestHandler } from 'express';
import httpStatus from 'http-status-codes';
import { injectable, inject } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { LogContext, UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';
import { MetadataManager } from '../models/metadataManager';
import { MetadataParams } from '../../externalServices/catalog/interfaces';

type UpdateMetadataHandler = RequestHandler<MetadataParams, unknown, UpdatePayload>;
type UpdateStatusHandler = RequestHandler<MetadataParams, unknown, UpdateStatusPayload>;

@injectable()
export class MetadataController {
  private readonly logContext: LogContext;

  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, @inject(MetadataManager) private readonly manager: MetadataManager) {
    this.logContext = {
      fileName: __filename,
      class: MetadataController.name,
    };
  }

  public updateMetadata: UpdateMetadataHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.updateMetadata.name };
    const { identifier } = req.params;
    try {
      const payload = req.body;
      const response = await this.manager.updateMetadata(identifier, payload);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({
        msg: `Failed in updating the metadata!`,
        logContext,
        error,
      });
      return next(error);
    }
  };

  public updateStatus: UpdateStatusHandler = async (req, res, next) => {
    const logContext = { ...this.logContext, function: this.updateStatus.name };
    const { identifier } = req.params;
    try {
      const payload = req.body;
      const response = await this.manager.updateStatus(identifier, payload);
      return res.status(httpStatus.OK).json(response);
    } catch (error) {
      this.logger.error({
        msg: `Failed in changing the status!`,
        logContext,
        error,
      });
      return next(error);
    }
  };
}
