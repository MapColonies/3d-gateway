import axios from 'axios';
import { inject, injectable } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { SERVICES } from '../../common/constants';
import { AppError } from '../../common/appError';
import { IConfig, UpdatePayload, UpdateStatusPayload } from '../../common/interfaces';
import { CatalogConfig, Record3D } from './interfaces';

@injectable()
export class CatalogCall {
  private readonly catalog: CatalogConfig;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) private readonly logger: Logger) {
    this.catalog = this.config.get<CatalogConfig>('catalog');
  }

  public async getRecord(identifier: string): Promise<Record3D | undefined> {
    this.logger.debug({
      msg: 'Get Record from catalog service (CRUD)',
    });
    try {
      const response = await axios.get<Record3D | undefined>(`${this.catalog.url}/${this.catalog.subUrl}/${identifier}`);
      this.logger.debug({
        msg: 'Got Record from catalog service (CRUD)',
        record: response.data,
      });
      return response.data;
    } catch (error) {
      this.logger.error({ msg: 'Something went wrong in catalog', error });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with catalog', true);
    }
  }

  public async isProductIdExist(productId: string): Promise<boolean> {
    this.logger.debug({
      msg: 'Find last version of product from catalog service (CRUD)',
    });
    try {
      const response = await axios.get<Record3D>(`${this.catalog.url}/${this.catalog.subUrl}/lastVersion/${productId}`);
      if (response.status === StatusCodes.OK.valueOf()) {
        return true;
      }
      if (response.status === StatusCodes.NOT_FOUND.valueOf()) {
        return false;
      }
      this.logger.error({ msg: 'Got unexpected status-code form catalog', response });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during validation of productId existence', true);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.error({ msg: 'Something went wrong in catalog', error });
      throw new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'there is a problem with catalog', true);
    }
  }

  public async patchMetadata(identifier: string, payload: UpdatePayload): Promise<Record3D> {
    this.logger.debug({
      msg: 'Send post request to catalog service (CRUD) in order to update metadata',
    });
    const response = await axios.patch<Record3D>(`${this.catalog.url}/${this.catalog.subUrl}/${identifier}`, payload);
    if (response.status === StatusCodes.OK.valueOf()) {
      return response.data;
    }
    this.logger.error({ msg: 'Got unexpected status-code from catalog', response });
    throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during send updatedMetadata', true);
  }

  public async changeStatus(identifier: string, payload: UpdateStatusPayload): Promise<Record3D> {
    this.logger.debug({
      msg: 'Change status of model in catalog service (CRUD)',
    });
    const response = await axios.patch<Record3D>(`${this.catalog.url}/${this.catalog.subUrl}/status/${identifier}`, payload);
    if (response.status === StatusCodes.OK.valueOf()) {
      return response.data;
    }
    this.logger.error({ msg: 'Got unexpected status-code from catalog', response });
    throw new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'Problem with the catalog during status change', true);
  }
}
