import jsLogger from '@map-colonies/js-logger';
import { AppError } from '../../../../src/common/appError';
import { UpdatePayload } from '../../../../src/common/interfaces';
import { createUpdatePayload, createUpdateStatusPayload, createUuid } from '../../../helpers/helpers';
import { catalogMock, validationManagerMock } from '../../../helpers/mockCreator';
import { MetadataManager } from '../../../../src/metadata/models/metadataManager';

let metadataManager: MetadataManager;

describe('MetadataManager', () => {
  beforeEach(() => {
    metadataManager = new MetadataManager(jsLogger({ enabled: false }), validationManagerMock as never, catalogMock as never);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateMetadata tests', () => {
    it('resolves without errors', async () => {
      const identifier = createUuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockReturnValue(true);
      catalogMock.patchMetadata.mockResolvedValue(payload);

      const response = await metadataManager.updateMetadata(identifier, payload);

      expect(response).toMatchObject(payload);
    });

    it(`rejects if update's validation failed`, async () => {
      const identifier = createUuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockReturnValue('Some Error');

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects if one of the external-services of the validation is not available', async () => {
      const identifier = createUuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if didn't update metadata in catalog`, async () => {
      const identifier = createUuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockReturnValue(true);
      catalogMock.patchMetadata.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });
  });

  describe('updateStatus tests', () => {
    it('resolves without errors', async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      validationManagerMock.validateRecordExistence.mockReturnValue(true);
      catalogMock.changeStatus.mockResolvedValue(payload);

      const response = await metadataManager.updateStatus(identifier, payload);

      expect(response).toMatchObject(payload);
    });

    it(`rejects if update's validation failed`, async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      validationManagerMock.validateRecordExistence.mockReturnValue('Some Error');

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if catalog is not available during validation`, async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      validationManagerMock.validateRecordExistence.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if catalog is not available during update`, async () => {
      const identifier = createUuid();
      const payload = createUpdateStatusPayload();
      validationManagerMock.validateRecordExistence.mockReturnValue(true);
      catalogMock.changeStatus.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });
  });
});
