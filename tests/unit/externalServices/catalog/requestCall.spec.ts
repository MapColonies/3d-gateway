import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { CatalogCall } from '../../../../src/externalServices/catalog/requestCall';
import { CatalogConfig } from '../../../../src/externalServices/catalog/interfaces';
import { createRecord, createUpdatePayload, createUpdateStatusPayload, createUuid } from '../../../helpers/helpers';

let catalog: CatalogCall;

describe('catalogCall tests', () => {
  const catalogConfig = config.get<CatalogConfig>('catalog');
  beforeEach(() => {
    catalog = new CatalogCall(config, jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecord Function', () => {
    it('Returns the record when identifier exists in DB', async () => {
      const identifier = createUuid();
      const expected = createRecord();
      mockAxios.get.mockResolvedValueOnce({ data: expected });

      const response = await catalog.getRecord(identifier);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/${identifier}`);
      expect(response).toBe(expected);
    });

    it('Returns undefined when identifier does not exist in DB', async () => {
      const identifier = createUuid();
      mockAxios.get.mockResolvedValueOnce({ data: undefined });

      const response = await catalog.getRecord(identifier);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/${identifier}`);
      expect(response).toBeUndefined();
    });

    it('rejects if service is not available', async () => {
      const identifier = createUuid();
      mockAxios.get.mockRejectedValueOnce(new Error('catalog is not available'));

      const response = catalog.getRecord(identifier);

      await expect(response).rejects.toThrow('there is a problem with catalog');
    });
  });

  describe('isProductIdExist Function', () => {
    it('Returns true when productId exists in DB', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });

      const response = await catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/lastVersion/${productId}`);
      expect(response).toBe(true);
    });

    it('Returns false when productId does not exist in DB', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

      const response = await catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/lastVersion/${productId}`);
      expect(response).toBe(false);
    });

    it('Rejects if got unexpected response from catalog', async () => {
      const productId = createUuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.INTERNAL_SERVER_ERROR });

      const response = catalog.isProductIdExist(productId);

      expect(mockAxios.get).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/lastVersion/${productId}`);
      await expect(response).rejects.toThrow('Problem with the catalog during validation of productId existence');
    });

    it('rejects if service is not available', async () => {
      const productId = createUuid();
      mockAxios.get.mockRejectedValueOnce(new Error('catalog is not available'));

      const response = catalog.isProductIdExist(productId);

      await expect(response).rejects.toThrow('there is a problem with catalog');
    });
  });

  describe('patchMetadata Function', () => {
    it('Returns the response of the catalog when metadata was updated successfully', async () => {
      const identifier = createUuid();
      const payload = createUpdatePayload();
      mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: payload });

      const response = await catalog.patchMetadata(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/${identifier}`, payload);
      expect(response).toBe(payload);
    });

    it('Rejects if got unexpected response from catalog', async () => {
      const identifier = createUuid();
      const payload = createUpdatePayload();
      mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

      const response = catalog.patchMetadata(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/${identifier}`, payload);
      await expect(response).rejects.toThrow('Problem with the catalog during send updatedMetadata');
    });

    it('rejects if service is not available', async () => {
      const identifier = createUuid();
      const payload = createUpdatePayload();
      mockAxios.patch.mockRejectedValueOnce(new Error('catalog is not available'));

      const response = catalog.patchMetadata(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/${identifier}`, payload);
      await expect(response).rejects.toThrow('catalog is not available');
    });
  });

  describe('changeStatus Function', () => {
    it(`Returns the response of the catalog when metadata's status was updated successfully`, async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: payload });

      const response = await catalog.changeStatus(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/status/${identifier}`, payload);
      expect(response).toBe(payload);
    });

    it('Rejects if got unexpected response from catalog', async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

      const response = catalog.changeStatus(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/status/${identifier}`, payload);
      await expect(response).rejects.toThrow('Problem with the catalog during status change');
    });

    it('rejects if service is not available', async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      mockAxios.patch.mockRejectedValueOnce(new Error('catalog is not available'));

      const response = catalog.changeStatus(identifier, payload);

      expect(mockAxios.patch).toHaveBeenCalledWith(`${catalogConfig.url}/metadata/status/${identifier}`, payload);
      await expect(response).rejects.toThrow('catalog is not available');
    });
  });
});
