import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
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
      validationManagerMock.sourcesValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      storeTriggerMock.postPayload.mockResolvedValue(expected);

      const created = await modelManager.createModel(payload);

      expect(created).toMatchObject(expected);
    });

    it(`rejects if modelPath's validation failed`, async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      validationManagerMock.validateModelPath.mockReturnValue('Some ModelPath Error');

      const createPromise = modelManager.createModel(payload);

      await expect(createPromise).rejects.toThrow('Some ModelPath Error');
    });

    it(`rejects if sourcesValid validation failed`, async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.sourcesValid.mockResolvedValue({
        isValid: false,
        message: 'Some sourcesValid Error',
      });

      const createPromise = modelManager.createModel(payload);
      await expect(createPromise).rejects.toThrow('Some sourcesValid Error');
    });

    it(`rejects if isMetadataValid validation failed`, async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.sourcesValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: false,
        message: 'Some isMetadataValid Error',
      });

      const createPromise = modelManager.createModel(payload);
      await expect(createPromise).rejects.toThrow('Some isMetadataValid Error');
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
