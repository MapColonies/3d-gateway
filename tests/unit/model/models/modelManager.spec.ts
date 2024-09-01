import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { IngestionPayload, IngestionValidatePayload } from '../../../../src/common/interfaces';
import { ERROR_STORE_TRIGGER_ERROR, ModelManager } from '../../../../src/model/models/modelManager';
import { createFootprint, createIngestionPayload, createStoreTriggerPayload } from '../../../helpers/helpers';
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
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('createModel tests', () => {
    it('resolves without errors', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const created = await modelManager.createModel(payload);

      expect(created).toMatchObject(expected);
    });

    it('throw if validateModel rejects with error', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue('some model path error');
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const createdResponse = modelManager.createModel(payload);
      await expect(createdResponse).rejects.toThrow('some model path error');
    });

    it('throw if StoreTriggerPayload rejects with error', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');

      storeTriggerMock.postPayload.mockRejectedValue(new Error('storeTrigger error'));

      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const createdResponse = modelManager.createModel(payload);
      await expect(createdResponse).rejects.toThrow(ERROR_STORE_TRIGGER_ERROR );
    });
  });

  describe('validateModel tests', () => {
    it('resolves without errors if all properties exists (modelPath, tilesetFilename and metadata)', async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({ isValid: true });
    });

    it('resolves without errors if all properties exists (modelPath, tilesetFilename and metadata = undefined)', async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      delete payload.metadata;
      payload.metadata = undefined;
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({ isValid: true });
    });

    it(`rejects if modelPath's validation failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.validateModelPath.mockReturnValue('Some ModelPath Error');

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({ isValid: false, message: 'Some ModelPath Error' });
    });

    it(`rejects if validateExist for model file failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');

      modelManager = new ModelManager(
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValueOnce(false);
      validationManagerMock.validateExist.mockResolvedValueOnce(true);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      const response = await modelManager.validateModel(payload);
      expect(response.isValid).toBe(false);
      expect(response.message).toContain('Unknown model name!');
    });

    it(`rejects if validateExist for tileset failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Sphere');

      modelManager = new ModelManager(
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValueOnce(true);
      validationManagerMock.validateExist.mockResolvedValueOnce(false);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      const response = await modelManager.validateModel(payload);
      expect(response.isValid).toBe(false);
      expect(response.message).toContain('Unknown tileset name!');
    });

    it(`rejects if getTilesetModelPolygon failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Box');
      const expected: StoreTriggerPayload = createStoreTriggerPayload('Box');

      modelManager = new ModelManager(
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.postPayload.mockResolvedValue(expected);
      validationManagerMock.validateModelPath.mockReturnValue(true);
      validationManagerMock.validateExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(`Some getTilesetModelPolygon Error`);

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({
        isValid: false,
        message: `Some getTilesetModelPolygon Error`,
      });
    });
  });
});
