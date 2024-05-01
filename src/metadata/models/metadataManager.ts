import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import httpStatus from 'http-status-codes';
import client from 'prom-client';
import { SERVICES } from '../../common/constants';
import { ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { CatalogCall } from '../../externalServices/catalog/requestCall';
import { IConfig, UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';

@injectable()
export class MetadataManager {
    //metrics
    private readonly requestCounter?: client.Counter<'requestType'>;
    private readonly requestsHistogram?: client.Histogram<'requestType'>;
    
    public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(CatalogCall) private readonly catalog: CatalogCall,
    @inject(SERVICES.METRICS_REGISTRY) registry?: client.Registry
  ) {
    if (registry !== undefined) {
      this.requestCounter = new client.Counter({
        name: 'record_requests_total',
        help: 'The total number of requests',
        labelNames: ['requestType'] as const,
        registers: [registry],
      });

      this.requestsHistogram = new client.Histogram({
        name: 'requests_duration_seconds',
        help: 'requests duration time (seconds)',
        buckets: config.get<number[]>('telemetry.metrics.buckets'),
        labelNames: ['requestType'] as const,
        registers: [registry],
      });
    }
  }

  public async updateMetadata(identifier: string, payload: UpdatePayload): Promise<unknown> {
    this.logger.info({ msg: 'started update of metadata', modelId: identifier, payload });
    this.requestCounter?.inc({ requestType: 'PATCH' });
    this.logger.debug({ msg: 'starting validating the payload', modelId: identifier });
    const updateTimerEnd = this.requestsHistogram?.startTimer({ requestType: 'PATCH' });
    try {
      const validated: boolean | string = await this.validator.validateUpdate(identifier, payload);
      if (typeof validated == 'string') {
        throw new AppError('badRequest', httpStatus.BAD_REQUEST, validated, true);
      }
      this.logger.info({ msg: 'model validated successfully', modelId: identifier });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'unfamiliar error', error });
      throw new AppError('error', httpStatus.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.patchMetadata(identifier, payload);
      if (updateTimerEnd) {
        updateTimerEnd();
      }
      return response;
    } catch (error) {
      this.logger.error({ msg: 'Error while sending to catalog service', modelId: identifier, error, payload });
      throw new AppError('catalog', httpStatus.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }

  public async updateStatus(identifier: string, payload: UpdateStatusPayload): Promise<unknown> {
    this.logger.info({ msg: 'started update of metadata', modelId: identifier, payload });
    this.requestCounter?.inc({ requestType: 'PATCH' });
    this.logger.debug({ msg: 'starting validating the payload', modelId: identifier });
    const updateTimerEnd = this.requestsHistogram?.startTimer({ requestType: 'PATCH' });
    try {
      if ((await this.catalog.getRecord(identifier)) === undefined) {
        throw new AppError('badRequest', httpStatus.BAD_REQUEST, `Record with identifier: ${identifier} doesn't exist!`, true);
      }
      this.logger.info({ msg: 'model validated successfully', modelId: identifier });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'unfamiliar error', error });
      throw new AppError('error', httpStatus.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.changeStatus(identifier, payload);
      if (updateTimerEnd) {
        updateTimerEnd();
      }
      return response;
    } catch (error) {
      this.logger.error({ msg: 'Error while sending to catalog service', modelId: identifier, error, payload });
      throw new AppError('catalog', httpStatus.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }
}
