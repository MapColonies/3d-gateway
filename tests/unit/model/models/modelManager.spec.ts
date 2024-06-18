import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload } from '../../../../src/common/interfaces';
import { ModelManager } from '../../../../src/model/models/modelManager';
import { createIngestionPayload, createStoreTriggerPayload } from '../../../helpers/helpers';
import { storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerPayload } from '../../../../src/externalServices/storeTrigger/interfaces';

let modelManager: ModelManager;

describe('ModelManager', () => {
  beforeEach(() => {
    modelManager = new ModelManager(
      jsLogger({ enabled: false }),
      trace.getTracer('testTracer'),
      validationManagerMock as never,
      storeTriggerMock as never
    );
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
});
