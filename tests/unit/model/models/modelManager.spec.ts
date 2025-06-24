import config from 'config';
import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import { IngestionPayload, IngestionValidatePayload } from '../../../../src/common/interfaces';
import { ERROR_STORE_TRIGGER_ERROR, ModelManager } from '../../../../src/model/models/modelManager';
import { createFootprint, createIngestionPayload, createStoreTriggerPayload } from '../../../helpers/helpers';
import { storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerIngestionPayload } from '../../../../src/externalServices/storeTrigger/interfaces';

let modelManager: ModelManager;

describe('ModelManager', () => {
  beforeEach(() => {
    modelManager = new ModelManager(
      config,
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
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const created = await modelManager.createModel(payload);

      expect(created).toMatchObject(expected);
    });

    it('throw if validateModel rejects with error', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(false);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const createdResponse = modelManager.createModel(payload);
      await expect(createdResponse).rejects.toThrow(
        "Unknown model path! The model isn't in the agreed folder!, modelPath: \\\\tmp\\tilesets\\models\\Sphere, basePath: \\\\tmp\\tilesets\\models"
      );
    });

    it('throw if StoreTriggerIngestionPayload rejects with error', async () => {
      const payload: IngestionPayload = createIngestionPayload('Sphere');

      storeTriggerMock.startIngestion.mockRejectedValue(new Error('storeTrigger error'));

      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(createFootprint());

      const createdResponse = modelManager.createModel(payload);
      await expect(createdResponse).rejects.toThrow(ERROR_STORE_TRIGGER_ERROR);
    });
  });

  describe('validateModel tests', () => {
    it('resolves without errors if all properties exists (modelPath, tilesetFilename and metadata)', async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockReturnValue({
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
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockReturnValue({
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
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');
      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.isModelPathValid.mockReturnValue(false);

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({
        isValid: false,
        message:
          "Unknown model path! The model isn't in the agreed folder!, modelPath: \\\\tmp\\tilesets\\models\\Sphere, basePath: \\\\tmp\\tilesets\\models",
      });
    });

    it(`rejects if isPathExist for model file failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');

      modelManager = new ModelManager(
        config,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValueOnce(false);
      validationManagerMock.isPathExist.mockResolvedValueOnce(true);
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      const response = await modelManager.validateModel(payload);
      expect(response.isValid).toBe(false);
      expect(response.message).toContain('Unknown model name!');
    });

    it(`rejects if isPathExist for tileset failed`, async () => {
      const payload: IngestionValidatePayload = createIngestionPayload('Sphere');
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');

      modelManager = new ModelManager(
        config,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValueOnce(true);
      validationManagerMock.isPathExist.mockResolvedValueOnce(false);
      validationManagerMock.isPolygonValid.mockReturnValue({
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
      const expected: StoreTriggerIngestionPayload = createStoreTriggerPayload('Box');

      modelManager = new ModelManager(
        config,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        validationManagerMock as never,
        storeTriggerMock as never
      );

      storeTriggerMock.startIngestion.mockResolvedValue(expected);
      validationManagerMock.isModelPathValid.mockReturnValue(true);
      validationManagerMock.isPathExist.mockResolvedValue(true);
      validationManagerMock.isPolygonValid.mockReturnValue({
        isValid: true,
      });
      validationManagerMock.isMetadataValid.mockResolvedValue({
        isValid: true,
      });
      validationManagerMock.getTilesetModelPolygon.mockReturnValue(undefined);

      const response = await modelManager.validateModel(payload);
      expect(response).toStrictEqual({
        isValid: false,
        message: '',
      });
    });
  });
});
