import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { AppError } from '../../../../src/common/appError';
import { IngestionPayload, IngestionSourcesPayload, ValidationResponse } from '../../../../src/common/interfaces';
import { ModelManager } from '../../../../src/model/models/modelManager';
import { createIngestionPayload, createStoreTriggerPayload, createValidateSourcesPayload } from '../../../helpers/helpers';
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

  describe('validateModelSources tests', () => {
    it('resolves without errors', async () => {
      const payload: IngestionSourcesPayload = createValidateSourcesPayload('Sphere');

      validationManagerMock.validateModelPath.mockReturnValue(true);
      const validResponse: ValidationResponse = {
        isValid: true,
      };
      validationManagerMock.sourcesValid.mockResolvedValue(validResponse);

      const expectedSourcesValidationResponse: ValidationResponse = {
        isValid: true,
      };
      const isValidResponse: ValidationResponse = await modelManager.validateModelSources(payload);
      expect(isValidResponse).toMatchObject(expectedSourcesValidationResponse);
    });

    it('resolves invalid response for validateModelPath=false', async () => {
      const payload: IngestionSourcesPayload = createValidateSourcesPayload('Sphere');

      const validResponse: ValidationResponse = {
        isValid: true,
      };
      validationManagerMock.validateModelPath.mockReturnValue(`invalidResponse`);
      validationManagerMock.sourcesValid.mockResolvedValue(validResponse);

      const expectedSourcesValidationResponse: ValidationResponse = {
        isValid: false,
        message: `invalidResponse`,
      };
      const response: ValidationResponse = await modelManager.validateModelSources(payload);
      expect(response).toMatchObject(expectedSourcesValidationResponse);
    });

    it('resolves invalid response for sourcesValid=false', async () => {
      const payload: IngestionSourcesPayload = createValidateSourcesPayload('Sphere');

      validationManagerMock.validateModelPath.mockReturnValue(true);
      const inValidResponse: ValidationResponse = {
        isValid: false,
        message: `invalidResponse`,
      };
      validationManagerMock.sourcesValid.mockResolvedValue(inValidResponse);

      const expectedSourcesValidationResponse: ValidationResponse = {
        isValid: false,
        message: `invalidResponse`,
      };
      const response: ValidationResponse = await modelManager.validateModelSources(payload);
      expect(response).toMatchObject(expectedSourcesValidationResponse);
    });
  });
});
