import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from '../../common/constants';
import { AppError } from '../../common/appError';
import { IConfig } from '../../common/interfaces';
import { ILookupOption, LookupTablesConfig } from './interfaces';

@injectable()
export class LookupTablesCall {
  private readonly lookupTables: LookupTablesConfig;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.lookupTables = this.config.get<LookupTablesConfig>('lookupTables');
  }

  public async getClassifications(): Promise<string[]> {
    this.logger.debug({
      msg: 'Get Classifications from lookup-tables service',
    });
    try {
      const response = await axios.get<ILookupOption[]>(`${this.lookupTables.url}/${this.lookupTables.subUrl}/classification`);
      const classifications: string[] = [];
      for (const item of response.data) {
        classifications.push(item.value);
      }
      this.logger.debug({
        msg: 'Got Classifications',
        classifications,
      });
      return classifications;
    } catch (error) {
      this.logger.error({ msg: 'something went wrong with lookup-tables service', error });
      throw new AppError('lookup-tables', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with lookup-tables', true);
    }
  }
}
