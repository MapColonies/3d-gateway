import jsLogger from '@map-colonies/js-logger';
import { StatusCodes } from 'http-status-codes';
import { RecordStatus } from '@map-colonies/mc-model-types';
import { randWord } from '@ngneat/falso';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload } from '../../../../src/common/interfaces';
import { ModelManager } from '../../../../src/model/models/modelManager';
import { createFakeDeleteRequest, createIngestionPayload, createRecord, createStoreTriggerPayload, createUuid } from '../../../helpers/helpers';
import { catalogMock, storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerIngestionPayload } from '../../../../src/externalServices/storeTrigger/interfaces';

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
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
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
      const expectedResponse = createFakeDeleteRequest();

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deletePayload.mockResolvedValue(expectedResponse);

      const response = await modelManager.deleteModel(identifier);

      expect(response).toEqual(expectedResponse);
    });

    it('rejects if the identifier is not found in catalog', async () => {
      const identifier = createUuid();

      catalogMock.getRecord.mockResolvedValue(undefined);
      storeTriggerMock.deletePayload.mockRejectedValue(
        new AppError('NOT_FOUND', StatusCodes.NOT_FOUND, `Identifier ${identifier} wasn't found on DB`, true)
      );

      const response = modelManager.deleteModel(identifier);

      await expect(response).rejects.toThrow(`Identifier ${identifier} wasn't found on DB`);
    });

    it('rejects if productStatus is PUBLISHED', async () => {
      const identifier = createUuid();
      const record = createRecord();
      record.productStatus = RecordStatus.PUBLISHED;

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deletePayload.mockRejectedValue(
        new AppError(
          'BAD_REQUEST',
          StatusCodes.BAD_REQUEST,
          `Model ${record.productName} is PUBLISHED. The model must be UNPUBLISHED to be deleted!`,
          true
        )
      );
      const response = modelManager.deleteModel(identifier);

      await expect(response).rejects.toThrow(`Model ${record.productName} is PUBLISHED. The model must be UNPUBLISHED to be deleted!`);
    });

    it('reject if link cannot be extracted', async () => {
      const identifier = createUuid();
      const record = createRecord();
      record.links = randWord();

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deletePayload.mockRejectedValue(
        new AppError('BAD_REQUEST', StatusCodes.BAD_REQUEST, `link cannot be extracted ${record.links}`, true)
      );

      const response = modelManager.deleteModel(identifier);

      await expect(response).rejects.toThrow(`link cannot be extracted ${record.links}`);
    });

    it('rejects if catalog is not available', async () => {
      const identifier = createUuid();
      catalogMock.getRecord.mockRejectedValue(new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Catalog service is not available', true));

      const responsePromise = modelManager.deleteModel(identifier);

      await expect(responsePromise).rejects.toThrow(
        new AppError('catalog', StatusCodes.INTERNAL_SERVER_ERROR, 'Catalog service is not available', true)
      );
    });

    it('rejects if storeTrigger is not available', async () => {
      const identifier = createUuid();
      const record = createRecord();

      catalogMock.getRecord.mockResolvedValue(record);
      storeTriggerMock.deletePayload.mockRejectedValue(new Error('StoreTrigger service is not available'));

      const responsePromise = modelManager.deleteModel(identifier);

      await expect(responsePromise).rejects.toThrow(
        new AppError('', StatusCodes.INTERNAL_SERVER_ERROR, 'store-trigger service is not available', true)
      );
    });
  });
});
