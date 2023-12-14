import jsLogger from '@map-colonies/js-logger';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload, UpdatePayload } from '../../../../src/common/interfaces';
import { MiddlewareManager } from '../../../../src/middleware/models/middlewareManager';
import { createIngestionPayload, createStoreTriggerPayload, createUpdatePayload, createUuid } from '../../../helpers/helpers';
import { catalogMock, storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerPayload } from '../../../../src/externalServices/storeTrigger/interfaces';

let middlewareManager: MiddlewareManager;

describe('MiddlewareManager', () => {
  beforeEach(() => {
    middlewareManager = new MiddlewareManager(jsLogger({ enabled: false }), validationManagerMock as never, storeTriggerMock as never, catalogMock as never);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createModel tests', () => {
    it('resolves without errors', async () => {
      const request: IngestionPayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue(true);
      storeTriggerMock.postPayload.mockResolvedValue(expected);

      const created = await middlewareManager.createModel(request);

      expect(created).toMatchObject(expected);
    });

    it(`rejects if modelPath's validation failed`, async () => {
      const request: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue('Some Error');

      const createPromise = middlewareManager.createModel(request);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it(`rejects if ingestion's validation failed`, async () => {
      const request: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue('Some Error');

      const createPromise = middlewareManager.createModel(request);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it('rejects if one of the external-services of the validation is not available', async () => {
      const request: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockRejectedValue(new Error('lookup-tables service is not available'));

      const createPromise = middlewareManager.createModel(request);

      await expect(createPromise).rejects.toThrow(AppError);
    });

    it('rejects if storeTrigger is not available', async () => {
      const request: IngestionPayload = createIngestionPayload();
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateIngestion.mockReturnValue(true);
      storeTriggerMock.postPayload.mockRejectedValue(new Error('store-trigger service is not available'));

      const createPromise = middlewareManager.createModel(request);

      await expect(createPromise).rejects.toThrow('store-trigger service is not available');
    });
  });

  describe('updateMetadata tests', () => {
    it('resolves without errors', async () => {
      const identifier = createUuid();
      const request: UpdatePayload = createUpdatePayload();
      const expected = true
      validationManagerMock.validateUpdate.mockReturnValue(true);
      catalogMock.patchMetadata.mockResolvedValue(expected);

      const response = await middlewareManager.updateMetadata(identifier, request);

      expect(response).toMatchObject(expected);
    });

    it(`rejects if update's validation failed`, async () => {
      const identifier = createUuid();
      const request: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockReturnValue('Some Error');

      const response = await middlewareManager.updateMetadata(identifier, request);

      await expect(response).rejects.toThrow(AppError);
    });

    it('rejects if one of the external-services of the validation is not available', async () => {
      const identifier = createUuid();
      const request: UpdatePayload = createUpdatePayload();
      validationManagerMock.validateUpdate.mockRejectedValue(new Error('catalog service is not available'));

      const response = await middlewareManager.updateMetadata(identifier, request);

      await expect(response).rejects.toThrow(AppError);
    });
  });
});
