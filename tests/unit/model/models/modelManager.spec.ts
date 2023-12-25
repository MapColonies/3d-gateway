import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload } from '../../../../src/common/interfaces';
import { ModelManager } from '../../../../src/model/models/modelManager';
import { createFakeDeleteRequest, createIngestionPayload, createRecord, createStoreTriggerPayload, createUuid } from '../../../helpers/helpers';
import { catalogMock, storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../../../src/externalServices/storeTrigger/interfaces';
import { DeleteRequest } from '../../../../src/externalServices/catalog/interfaces';

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
      const request: DeleteRequest = createFakeDeleteRequest();
      const expected: StoreTriggerResponse = {
        jobID: createUuid(),
        status: OperationStatus.IN_PROGRESS,
      };

      catalogMock.getRecord.mockResolvedValue(createRecord(request.modelId));
      storeTriggerMock.deleteModel.mockResolvedValue({ data: expected });

      const response: StoreTriggerResponse = await modelManager.deleteModel(request.modelId);

      expect(response).toMatchObject(expected);
    });

    it('rejects with AppError if the identifier is not found in catalog', async () => {
      const nonExistentId = createUuid();
      catalogMock.getRecord.mockResolvedValue(undefined);

      const response = modelManager.deleteModel(nonExistentId);

      await expect(response).rejects.toThrow(AppError);

      it('rejects if catalog is not available', async () => {
        const request: DeleteRequest = createFakeDeleteRequest();
        catalogMock.getRecord.mockRejectedValue(new Error('catalog service is not available'));

        const response = modelManager.deleteModel(request.modelId);

        await expect(response).rejects.toThrow(AppError);
      });

      it('rejects if storeTrigger is not available', async () => {
        const request: DeleteRequest = createFakeDeleteRequest();
        storeTriggerMock.postPayload.mockRejectedValue(new Error('store-trigger service is not available'));

        const response = modelManager.deleteModel(request.modelId);

        await expect(response).rejects.toThrow('store-trigger service is not available');
      });
    });
  });
});
