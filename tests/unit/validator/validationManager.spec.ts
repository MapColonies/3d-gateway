import { join } from 'node:path';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { ProductType } from '@map-colonies/mc-model-types';
import { ValidationManager } from '../../../src/validator/validationManager';
import { ValidationResponse } from '../../../src/common/interfaces';
import {
  createModelPath,
  createMountedModelPath,
  createWrongFootprintCoordinates,
  createFootprint,
  createRecord,
  createUpdatePayload,
  getTileset,
  createValidateSourcesPayload,
  createIngestionPayload,
} from '../../helpers/helpers';
import { configMock, lookupTablesMock, catalogMock, providerMock } from '../../helpers/mockCreator';
import { AppError } from '../../../src/common/appError';

describe('ValidationManager', () => {
  let validationManager: ValidationManager;

  beforeEach(() => {
    validationManager = new ValidationManager(
      config,
      jsLogger({ enabled: false }),
      trace.getTracer('testTracer'),
      lookupTablesMock as never,
      catalogMock as never,
      providerMock as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isMetadataValid tests', () => {
    it('returns true when got all functions valid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: true });
    });

    it('returns false when resolutions are invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      payload.metadata.maxResolutionMeter = 554;
      payload.metadata.minResolutionMeter = 555;

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({
        isValid: false,
        message: 'minResolutionMeter should not be bigger than maxResolutionMeter',
      });
    });

    it.each([{ minResolution: undefined, maxResolution: 10 }, 
      { minResolution: 10, maxResolution: undefined },
      { minResolution: undefined, maxResolution: undefined }])('returns true for undefeined resolution %p', async (testInput: { minResolution?: number, maxResolution?: number }) => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      payload.metadata.minResolutionMeter = testInput.minResolution;
      payload.metadata.minResolutionMeter = testInput.maxResolution;

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: true });
    });

    it('returns false when got dates are invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      payload.metadata.sourceDateStart = new Date(555);
      payload.metadata.sourceDateEnd = new Date(554);

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: false, message: 'sourceStartDate should not be later than sourceEndDate' });
    });

    it('returns false when footprint polygon scheme is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      payload.metadata.footprint = createWrongFootprintCoordinates();
      payload.metadata.footprint.coordinates = [[[]]];

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({
        isValid: false,
        message: `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. polygon: ${JSON.stringify(
          payload.metadata.footprint
        )}`,
      });
    });

    it('returns false when footprint polygon coordinates is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      payload.metadata.footprint = createWrongFootprintCoordinates();

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({
        isValid: false,
        message: `Wrong polygon: ${JSON.stringify(payload.metadata.footprint)} the first and last coordinates should be equal`,
      });
    });

    it('throws error when something went wrong during the intersection', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      payload.tilesetFilename = 'invalidTileset.json';
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: false, message: `File tileset validation failed` });
    });

    it('returns error string when footprint does not intersect to model polygon', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      payload.metadata.footprint = createFootprint('Region');

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: false, message: `Wrong footprint! footprint's coordinates is not even close to the model!` });
    });

    it('returns error string when footprint does not intersects enough with model polygon', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      configMock.get.mockReturnValue(100);
      validationManager = new ValidationManager(
        configMock,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response.isValid).toBe(false);
      expect(response.message).toContain('The footprint intersectection with the model');
    });

    it('throws error if product type is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      payload.metadata.productType = faker.animal.bear() as unknown as ProductType;
      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload, tilesetLocation);
      expect(response).toStrictEqual({ isValid: true }); // For now, the validation will be only warning. so it's true
    });
  });

  describe('sourcesValid tests', () => {
    describe('sourcesValid tests', () => {
      it.each(['Sphere', 'Region'])('should check if sources are valid and return true for %p', async (testInput: string) => {
        const payload = createValidateSourcesPayload(testInput);
        payload.modelPath = createMountedModelPath(testInput);
        payload.adjustedModelPath = payload.modelPath;

        const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
        const response = await validationManager.sourcesValid(payload, tilesetLocation);
        const expectedResponse: ValidationResponse = {
          isValid: true,
        };
        expect(response).toStrictEqual(expectedResponse);
      });
    });

    it('should check if sources are valid and return false for Box tileset', async () => {
      const testInput = 'Box';
      const payload = createValidateSourcesPayload(testInput);
      payload.modelPath = createMountedModelPath(testInput);
      payload.adjustedModelPath = payload.modelPath;

      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      const response = await validationManager.sourcesValid(payload, tilesetLocation);
      const expectedResponse: ValidationResponse = {
        isValid: false,
        message: `BoundingVolume of box is not supported yet... Please contact 3D team.`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if modelPath is invalid', async () => {
      const payload = createValidateSourcesPayload();
      payload.modelPath = 'invalidModelName';
      payload.adjustedModelPath = payload.modelPath;

      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      const response = await validationManager.sourcesValid(payload, tilesetLocation);
      const expectedResponse: ValidationResponse = {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${payload.modelPath}`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if TilesetJson is invalid', async () => {
      const payload = createValidateSourcesPayload();
      payload.modelPath = createMountedModelPath();
      payload.tilesetFilename = 'invalidTilesetFilename';
      payload.adjustedModelPath = payload.modelPath;

      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      const response = await validationManager.sourcesValid(payload, tilesetLocation);
      const expectedResponse: ValidationResponse = {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if TilesetJson is invalid JSON', async () => {
      const payload = createValidateSourcesPayload();
      payload.modelPath = createMountedModelPath();
      payload.tilesetFilename = 'invalidTileset.json';
      payload.adjustedModelPath = payload.modelPath;

      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      const response = await validationManager.sourcesValid(payload, tilesetLocation);

      const expectedResponse: ValidationResponse = {
        isValid: false,
        message: `File tileset validation failed`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if TilesetJson contains invalid 3DTiles format', async () => {
      const payload = createValidateSourcesPayload();
      payload.modelPath = createMountedModelPath();
      payload.tilesetFilename = 'invalidTileset3Dtiles.json';
      payload.adjustedModelPath = payload.modelPath;

      const tilesetLocation = join(payload.modelPath, payload.tilesetFilename);
      const response = await validationManager.sourcesValid(payload, tilesetLocation);
      const expectedResponse: ValidationResponse = {
        isValid: false,
        message: 'Bad tileset format. Should be in 3DTiles format',
      };
      expect(response).toStrictEqual(expectedResponse);
    });
  });

  describe('validateModelPath tests', () => {
    it('returns true when got valid model path', () => {
      const modelPath = createModelPath();

      const result = validationManager.validateModelPath(modelPath);

      expect(result).toBe(true);
    });

    it('returns error string when model path not in the agreed path', () => {
      const modelPath = 'some/path';

      const result = validationManager.validateModelPath(modelPath);

      expect(result).toContain(`Unknown model path! The model isn't in the agreed folder!`);
    });
  });

  describe('validateUpdate', () => {
    it('returns true when got all functions valid', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      const record = createRecord();
      catalogMock.getRecord.mockResolvedValue(record);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.classification]);
      providerMock.getFile.mockResolvedValue(getTileset());

      const response = await validationManager.validateUpdate(identifier, payload);

      expect(response).toBe(true);
    });

    it('returns error string when has one invalid function', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      catalogMock.getRecord.mockResolvedValue(undefined);

      const response = await validationManager.validateUpdate(identifier, payload);

      expect(typeof response).toBe('string');
    });

    it('throws error when one of the external services does not properly responded', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      catalogMock.getRecord.mockRejectedValue(new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, 'catalog error', true));

      const response = validationManager.validateUpdate(identifier, payload);

      await expect(response).rejects.toThrow('catalog error');
    });
  });
});
