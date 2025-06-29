import config from 'config';
import { trace } from '@opentelemetry/api';
import jsLogger from '@map-colonies/js-logger';
import { ProductType, RecordStatus } from '@map-colonies/mc-model-types';
import { faker } from '@faker-js/faker';
import { IngestionPayload, IngestionValidatePayload } from '../../../../src/common/interfaces';
import { ERROR_STORE_TRIGGER_ERROR, ModelManager } from '../../../../src/model/models/modelManager';
import { createFootprint, createIngestionPayload, createRecord, createStoreTriggerPayload } from '../../../helpers/helpers';
import { catalogMock, storeTriggerMock, validationManagerMock } from '../../../helpers/mockCreator';
import { StoreTriggerIngestionPayload } from '../../../../src/externalServices/storeTrigger/interfaces';

let modelManager: ModelManager;

describe('ModelManager', () => {
  beforeEach(() => {
    modelManager = new ModelManager(
      config,
      jsLogger({ enabled: false }),
      trace.getTracer('testTracer'),
      catalogMock as never,
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
        catalogMock as never,
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
        catalogMock as never,
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
        catalogMock as never,
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

  describe('deleteModel tests', () => {
    it('resolves without errors', async () => {
      const expectedResponse: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValue([expectedRecord]);
      storeTriggerMock.startDelete.mockResolvedValue(expectedResponse);
      const deletedResponse = await modelManager.deleteModel(faker.string.uuid());

      expect(deletedResponse).toMatchObject(expectedResponse);
    });

    it('false when record doesnt exist in catalog - in validation', async () => {
      const expectedResponse: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValue([]);
      storeTriggerMock.startDelete.mockResolvedValue(expectedResponse);

      const responsePromise = modelManager.deleteModel(faker.string.uuid());
      await expect(responsePromise).rejects.toThrow('No record exists for that id');
    });

    it('false when record doesnt exist in catalog - after validation', async () => {
      const expectedResponse: StoreTriggerIngestionPayload = createStoreTriggerPayload('Sphere');

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValueOnce([expectedRecord]);
      catalogMock.findRecords.mockResolvedValueOnce([]);
      storeTriggerMock.startDelete.mockResolvedValue(expectedResponse);

      const responsePromise = modelManager.deleteModel(faker.string.uuid());
      await expect(responsePromise).rejects.toThrow('RecordId matches more than 1 record');
    });

    it('throw if catalog.findRecords rejects with error', async () => {
      catalogMock.findRecords.mockRejectedValue(new Error('catalog error'));
      const responsePromise = modelManager.deleteModel(faker.string.uuid());

      await expect(responsePromise).rejects.toThrow('catalog error');
    });

    it('throw if storeTrigger.startDelete rejects with error', async () => {
      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValue([expectedRecord]);
      storeTriggerMock.startDelete.mockRejectedValue(new Error('storeTrigger error'));
      const responsePromise = modelManager.deleteModel(faker.string.uuid());

      await expect(responsePromise).rejects.toThrow('storeTrigger error');
    });
  });

  describe('validateDeleteById tests', () => {
    it('resolves without errors', async () => {
      const expectedValidateResponse = {
        isValid: true,
      };

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValue([expectedRecord]);
      const created = await modelManager.validateDelete(faker.string.uuid());

      expect(created).toMatchObject(expectedValidateResponse);
    });

    it('false when record doesnt exist in catalog', async () => {
      const expectedValidateResponse = {
        isValid: false,
        message: 'No record exists for that id',
      };

      catalogMock.findRecords.mockResolvedValue([]);
      const created = await modelManager.validateDelete(faker.string.uuid());

      expect(created).toMatchObject(expectedValidateResponse);
    });

    it('throw if catalog.findRecords rejects with error', async () => {
      catalogMock.findRecords.mockRejectedValue(new Error('catalog error'));
      const responsePromise = modelManager.validateDelete(faker.string.uuid());

      await expect(responsePromise).rejects.toThrow('catalog error');
    });

    it('false when record productType is not "3DPhotoRealistic"', async () => {
      const expectedValidateResponse = {
        isValid: false,
        message: `Can't delete record that it's productType isn't "3DPhotoRealistic"`,
      };

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.QUANTIZED_MESH_DSM_BEST;
      expectedRecord.productStatus = RecordStatus.UNPUBLISHED;

      catalogMock.findRecords.mockResolvedValue([expectedRecord]);
      const created = await modelManager.validateDelete(faker.string.uuid());

      expect(created).toMatchObject(expectedValidateResponse);
    });

    it('false when record productStatus is not "UNPUBLISHED"', async () => {
      const expectedValidateResponse = {
        isValid: false,
        message: `Can't delete record that it's productStatus isn't "UNPUBLISHED"`,
      };

      const expectedRecord = createRecord();
      expectedRecord.productType = ProductType.PHOTO_REALISTIC_3D;
      expectedRecord.productStatus = RecordStatus.PUBLISHED;

      catalogMock.findRecords.mockResolvedValue([expectedRecord]);
      const created = await modelManager.validateDelete(faker.string.uuid());

      expect(created).toMatchObject(expectedValidateResponse);
    });
  });
});
