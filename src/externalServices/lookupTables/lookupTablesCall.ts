import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { withSpanAsyncV4 } from '@map-colonies/telemetry';
import { Tracer } from '@opentelemetry/api';
import { SERVICES } from '../../common/constants';
import { AppError } from '../../common/appError';
import { LogContext } from '../../common/interfaces';
import { ConfigType } from '../../common/config';
import { ILookupOption } from './interfaces';

@injectable()
export class LookupTablesCall {
  private readonly logContext: LogContext;
  private readonly lookupTables;

  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: ConfigType,
    @inject(SERVICES.TRACER) public readonly tracer: Tracer,
    @inject(SERVICES.LOGGER) private readonly logger: Logger
  ) {
    this.lookupTables = this.config.get('externalServices.lookupTables');
    this.logContext = {
      fileName: __filename,
      class: LookupTablesCall.name,
    };
  }

  @withSpanAsyncV4
  public async getClassifications(): Promise<string[]> {
    const logContext = { ...this.logContext, function: this.getClassifications.name };
    this.logger.debug({
      msg: 'Get Classifications from lookup-tables service',
      logContext,
    });
    try {
      const response = await axios.get<ILookupOption[]>(`${this.lookupTables.url}/${this.lookupTables.subUrl}/classification`);
      const classifications: string[] = [];
      for (const item of response.data) {
        classifications.push(item.value);
      }
      this.logger.debug({
        msg: 'Got Classifications',
        logContext,
        classifications,
      });
      return classifications;
    } catch (error) {
      this.logger.error({
        msg: 'something went wrong with lookup-tables service',
        logContext,
        error,
      });
      throw new AppError('lookup-tables', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with lookup-tables', true);
    }
  }
}
