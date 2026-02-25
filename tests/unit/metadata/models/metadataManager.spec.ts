import { StatusCodes } from 'http-status-codes';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { faker } from '@faker-js/faker';
import { RecordStatus } from '@map-colonies/types';
import { AppError } from '../../../../src/common/appError';
import { UpdatePayload } from '../../../../src/common/interfaces';
import { createRecord, createUpdatePayload, createUpdateStatusPayload } from '../../../helpers/helpers';
import { catalogMock, validationManagerMock } from '../../../helpers/mockCreator';
import { MetadataManager } from '../../../../src/metadata/models/metadataManager';

let metadataManager: MetadataManager;

describe('MetadataManager', () => {
  beforeEach(() => {
    metadataManager = new MetadataManager(
      jsLogger({ enabled: false }),
      trace.getTracer('testTracer'),
      validationManagerMock as never,
      catalogMock as never
    );
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateMetadata tests', () => {
    it('resolves without errors', async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockResolvedValue(true);
      validationManagerMock.isRecordAbsentFromExtractable.mockResolvedValue(true);
      catalogMock.getRecord.mockResolvedValue(createRecord());
      catalogMock.patchMetadata.mockResolvedValue(payload);

      const response = await metadataManager.updateMetadata(identifier, payload);

      expect(response).toMatchObject(payload);
    });

    it(`rejects if update's validation failed`, async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockResolvedValue(false);

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects if one of the external-services of the validation is not available', async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if didn't update metadata in catalog`, async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockResolvedValue(true);
      validationManagerMock.isRecordAbsentFromExtractable.mockResolvedValue(true);
      catalogMock.patchMetadata.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects with conflict if validation failed due to extractable conflict', async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockResolvedValue(true);
      validationManagerMock.isRecordAbsentFromExtractable.mockImplementation(async (_id, ref) => {
        ref.outFailedReason = 'conflict reason';
        return false;
      });
      catalogMock.getRecord.mockResolvedValue(createRecord());

      const response = metadataManager.updateMetadata(identifier, payload);
      await expect(response).rejects.toThrow(AppError);
      await expect(response).rejects.toMatchObject({
        status: StatusCodes.CONFLICT,
        message: 'conflict reason',
      });
    });

    it('rejects with bad request if validation failed for other reasons', async () => {
      const identifier = faker.string.uuid();
      const payload: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockImplementation(async (_id, _pl, ref) => {
        ref.outFailedReason = 'bad request reason';
        return false;
      });

      const response = metadataManager.updateMetadata(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
      await expect(response).rejects.toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        message: 'bad request reason',
      });
    });
  });

  describe('updateStatus tests', () => {
    it('resolves without errors', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      const record = createRecord();
      catalogMock.getRecord.mockResolvedValue(record);
      validationManagerMock.isRecordAbsentFromExtractable.mockResolvedValue(true);
      catalogMock.changeStatus.mockResolvedValue(record);

      const response = await metadataManager.updateStatus(identifier, payload);

      expect(response).toMatchObject(record);
    });

    it(`rejects if update's validation failed with non-existing record`, async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      catalogMock.getRecord.mockResolvedValue(undefined);

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if update's validation failed when recieving record that is in Being-Deleted state`, async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      const record = createRecord();
      record.productStatus = RecordStatus.BEING_DELETED;
      catalogMock.getRecord.mockResolvedValue(record);

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if catalog is not available during validation`, async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      catalogMock.getRecord.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it(`rejects if catalog is not available during update`, async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      catalogMock.getRecord.mockResolvedValue(createRecord());

      validationManagerMock.isRecordAbsentFromExtractable.mockResolvedValue(true);
      catalogMock.changeStatus.mockRejectedValue(new Error('catalog service is not available'));

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects with conflict if validation failed', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdateStatusPayload();
      catalogMock.getRecord.mockResolvedValue(createRecord());
      validationManagerMock.isRecordAbsentFromExtractable.mockImplementation(async (_id, ref) => {
        ref.outFailedReason = 'conflict reason';
        return false;
      });

      const response = metadataManager.updateStatus(identifier, payload);

      await expect(response).rejects.toThrow(AppError);
      await expect(response).rejects.toMatchObject({
        status: StatusCodes.CONFLICT,
        message: 'conflict reason',
      });
    });
  });
});
