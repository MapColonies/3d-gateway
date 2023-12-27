import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { StatusCodes } from 'http-status-codes';
import { RecordStatus } from '@map-colonies/mc-model-types';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload } from '../../../../src/common/interfaces';
import { ModelManager } from '../../../../src/model/models/modelManager';
import { createIngestionPayload, createRecord, createStoreTriggerPayload, createUuid } from '../../../helpers/helpers';
import { catalogMock, storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../../../src/externalServices/storeTrigger/interfaces';

let modelManager: ModelManager;

describe('ModelManager', () => {
  beforeEach(() => {
    modelManager = new ModelManager(jsLogger({ enabled: false }), validationManagerMock as never, storeTriggerMock as never, catalogMock as never);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createModel tests', () => {
    it('resolves without errors', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue(true);
      storeTriggerMock.postPayload.mockResolvedValue(expected);

      const created = await modelManager.createModel(payload);

      expect(created).toMatchObject(expected);
    });

    it(`rejects if modelPath's validation failed`, async () => {
      const payload: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue('Some Error');

      const createPromise = modelManager.createModel(payload);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it(`rejects if ingestion's validation failed`, async () => {
      const payload: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue('Some Error');

      const createPromise = modelManager.createModel(payload);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it('rejects if one of the external-services of the validation is not available', async () => {
      const payload: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockRejectedValue(new Error('lookup-tables service is not available'));

      const createPromise = modelManager.createModel(payload);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it('rejects if storeTrigger is not available', async () => {
      const payload: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue(true);
      storeTriggerMock.postPayload.mockRejectedValue(new Error('store-trigger service is not available'));

      const createPromise = modelManager.createModel(payload);

      await expect(createPromise).rejects.toThrow('store-trigger service is not available');
    });
  });

  describe('deleteModel tests', () => {
    it('should send a delete request to storeTrigger successfully', async () => {
      const identifier = createUuid();
      const record = createRecord();
      const expectedResponse: StoreTriggerResponse = {
        jobID: 'testJobId',
        status: OperationStatus.IN_PROGRESS,
      };

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deleteModel.mockResolvedValue(expectedResponse);

      const response = await modelManager.deleteModel(identifier);

      expect(response).toEqual(expectedResponse);
    });

    it('rejects with AppError if the identifier is not found in catalog', async () => {
      const identifier = createUuid();
      const expectedError = new AppError('NOT_FOUND', StatusCodes.NOT_FOUND, `Identifier ${identifier} wasn't found on DB`, true);

      catalogMock.getRecord.mockResolvedValue(undefined);
      storeTriggerMock.deleteModel.mockResolvedValue(expectedError);

      const response = modelManager.deleteModel(identifier);

      await expect(response).rejects.toThrow(expectedError);
      await expect(response).rejects.toThrow(Error);
      await expect(response).rejects.toThrow(new AppError('NOT_FOUND', StatusCodes.NOT_FOUND, `Identifier ${identifier} wasn't found on DB`, true));
    });

    it('rejects with AppError it productStatus is PUBLISHED', async () => {
      const identifier = createUuid();
      const record = createRecord();
      const expectedError = new AppError(
        'BAD_REQUEST',
        StatusCodes.BAD_REQUEST,
        `Model ${record.productName} is PUBLISHED. The model must be UNPUBLISHED to be deleted!`,
        true
      );
      record.productStatus = RecordStatus.PUBLISHED;

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deleteModel.mockResolvedValue(expectedError);

      const response = modelManager.deleteModel(identifier);

      await expect(response).rejects.toThrow(expectedError);
      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects if catalog is not available', async () => {
      const identifier = createUuid();
      catalogMock.getRecord.mockRejectedValue(new Error('Catalog service is not available'));

      const responsePromise = modelManager.deleteModel(identifier);

      await expect(responsePromise).rejects.toThrow(Error);
      await expect(responsePromise).rejects.toThrow(
        new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Catalog service is not available', true)
      );
    });

    it('rejects if storeTrigger is not available', async () => {
      const identifier = createUuid();
      const record = createRecord();

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deleteModel.mockRejectedValue(new Error('StoreTrigger service is not available'));

      const responsePromise = modelManager.deleteModel(identifier);

      await expect(responsePromise).rejects.toThrow(Error);
      await expect(responsePromise).rejects.toThrow(
        new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true)
      );
    });
  });
});
