import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { CatalogCall } from '../../../../src/externalServices/catalog/requestCall';
import { CatalogConfig } from '../../../../src/externalServices/catalog/interfaces';
import { createUuid } from '../../../helpers/helpers';

let catalog: CatalogCall;

describe('catalogCall tests', () => {
  const catalogConfig = config.get<CatalogConfig>('catalog');
  beforeEach(() => {
    catalog = new CatalogCall(config, jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRecordExist Function', () => {
    it('Returns true when identifier exists in DB', async () => {
      const identifier = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.OK });

      const response = await catalog.isRecordExist(identifier);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/${identifier}`);
      expect(response).toBe(true);
    });

    it('Returns false when identifier does not exist in DB', async () => {
      const identifier = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.NOT_FOUND });

      const response = await catalog.isRecordExist(identifier);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/${identifier}`);
      expect(response).toBe(false);
    });

    it('Rejects if got unexpected response from catalog', async () => {
      const identifier = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.INTERNAL_SERVER_ERROR });

      const response = catalog.isRecordExist(identifier);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/${identifier}`);
      await expect(response).rejects.toThrow('Problem with the catalog during validation of record existence');
    });

    it('rejects if service is not available', async () => {
      const identifier = createUuid();
      mockAxios.get.mockRejectedValue(new Error('catalog is not available'));

      const response = catalog.isRecordExist(identifier);

      await expect(response).rejects.toThrow('there is a problem with catalog');
    });
  });

  describe('isProductIdExist Function', () => {
    it('Returns true when productId exists in DB', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.OK });

      const response = await catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/find/${productId}`);
      expect(response).toBe(true);
    });

    it('Returns false when productId does not exist in DB', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.NOT_FOUND });

      const response = await catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/find/${productId}`);
      expect(response).toBe(false);
    });

    it('Rejects if got unexpected response from catalog', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValue({ status: StatusCodes.INTERNAL_SERVER_ERROR });

      const response = catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/${catalogConfig.subUrl}/find/${productId}`);
      await expect(response).rejects.toThrow('Problem with the catalog during validation of productId existence');
    });

    it('rejects if service is not available', async () => {
      const productId = createUuid();
      mockAxios.get.mockRejectedValue(new Error('catalog is not available'));

      const response = catalog.isProductIdExist(productId);

      await expect(response).rejects.toThrow('there is a problem with catalog');
    });
  });
});
