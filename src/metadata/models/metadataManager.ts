import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { Tracer, trace } from '@opentelemetry/api';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { THREE_D_CONVENTIONS } from '@map-colonies/telemetry/conventions';
import { SERVICES } from '../../common/constants';
import { FailedReason, ValidationManager } from '../../validator/validationManager';
import { AppError } from '../../common/appError';
import { CatalogCall } from '../../externalServices/catalog/catalogCall';
import { LogContext, UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';
import { Record3D } from '../../externalServices/catalog/interfaces';

@injectable()
export class MetadataManager {
  private readonly logContext: LogContext;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(ValidationManager) private readonly validator: ValidationManager,
    @inject(CatalogCall) private readonly catalog: CatalogCall
  ) {
    this.logContext = {
      fileName: __filename,
      class: MetadataManager.name,
    };
  }

  @withSpanAsyncV4
  public async updateMetadata(identifier: string, payload: UpdatePayload): Promise<unknown> {
    const logContext = { ...this.logContext, function: this.updateMetadata.name };
    this.logger.info({
      msg: 'started update of metadata',
      logContext,
      modelId: identifier,
      payload,
    });
    this.logger.debug({
      msg: 'starting validating the payload',
      logContext,
      modelId: identifier,
    });

    const spanActive = trace.getActiveSpan();
    spanActive?.setAttributes({
      [THREE_D_CONVENTIONS.three_d.catalogManager.catalogId]: identifier,
    });

    try {
      const refReason: FailedReason = { outFailedReason: '' };
      const isValid: boolean = await this.validator.validateUpdate(identifier, payload, refReason);
      if (!isValid) {
        throw new AppError('badRequest', StatusCodes.BAD_REQUEST, refReason.outFailedReason, true);
      }
      this.logger.info({
        msg: 'model validated successfully',
        logContext,
        modelId: identifier,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({
        msg: 'unfamiliar error',
        logContext,
        error,
      });
      throw new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.patchMetadata(identifier, payload);
      return response;
    } catch (error) {
      this.logger.error({
        msg: 'Error while sending to catalog service',
        logContext,
        modelId: identifier,
        error,
        payload,
      });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }

  @withSpanAsyncV4
  public async updateStatus(identifier: string, payload: UpdateStatusPayload): Promise<Record3D> {
    const logContext = { ...this.logContext, function: this.updateStatus.name };
    this.logger.info({
      msg: 'started update of metadata',
      logContext,
      modelId: identifier,
      payload,
    });
    this.logger.debug({
      msg: 'starting validating the payload',
      logContext,
      modelId: identifier,
    });

    try {
      if ((await this.catalog.getRecord(identifier)) === undefined) {
        throw new AppError('badRequest', StatusCodes.BAD_REQUEST, `Record with identifier: ${identifier} doesn't exist!`, true);
      }
      this.logger.info({
        msg: 'model validated successfully',
        logContext,
        modelId: identifier,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({
        msg: 'unfamiliar error',
        logContext,
        error,
      });
      throw new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, String(error), true);
    }
    try {
      const response = await this.catalog.changeStatus(identifier, payload);
      return response;
    } catch (error) {
      this.logger.error({
        msg: 'Error while sending to catalog service',
        logContext,
        modelId: identifier,
        error,
        payload,
      });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is an error with catalog', true);
    }
  }
}
