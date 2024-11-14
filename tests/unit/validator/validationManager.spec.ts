import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Polygon, Position } from 'geojson';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { ProductType } from '@map-colonies/mc-model-types';
import {
  ERROR_METADATA_BAD_FORMAT_TILESET,
  ERROR_METADATA_BOX_TILESET,
  ERROR_METADATA_DATE,
  ERROR_METADATA_ERRORED_TILESET,
  ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL,
  ERROR_METADATA_RESOLUTION,
  FailedReason,
  ValidationManager,
} from '../../../src/validator/validationManager';
import {
  createModelPath,
  createMountedModelPath,
  createWrongFootprintCoordinates,
  createFootprint,
  createRecord,
  createUpdatePayload,
  getTileset,
  createIngestionPayload,
  createTilesetFileName,
  getBasePath,
} from '../../helpers/helpers';
import { configMock, lookupTablesMock, catalogMock, providerMock } from '../../helpers/mockCreator';
import { AppError } from '../../../src/common/appError';
import { FILE_ENCODING } from '../../../src/common/constants';

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

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: true });
    });

    it('returns false when resolutions are invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.maxResolutionMeter = 554;
      payload.metadata.minResolutionMeter = 555;

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({
        isValid: false,
        message: ERROR_METADATA_RESOLUTION,
      });
    });

    it.each([
      { minResolution: undefined, maxResolution: 10 },
      { minResolution: 10, maxResolution: undefined },
      { minResolution: undefined, maxResolution: undefined },
    ])('returns true for undefeined resolution %p', async (testInput: { minResolution?: number; maxResolution?: number }) => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.minResolutionMeter = testInput.minResolution;
      payload.metadata.minResolutionMeter = testInput.maxResolution;

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: true });
    });

    it('returns false when got dates are invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.sourceDateStart = new Date(555);
      payload.metadata.sourceDateEnd = new Date(554);

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: false, message: ERROR_METADATA_DATE });
    });

    it('returns false when footprint polygon scheme is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.footprint = createWrongFootprintCoordinates();
      payload.metadata.footprint.coordinates = [[[]]];

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({
        isValid: false,
        message: `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type", "coordinates" and "BBOX" only. polygon: ${JSON.stringify(
          payload.metadata.footprint
        )}`,
      });
    });

    it('returns false when footprint polygon coordinates is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.footprint = createWrongFootprintCoordinates();

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({
        isValid: false,
        message: `Wrong polygon: ${JSON.stringify(payload.metadata.footprint)} the first and last coordinates should be equal`,
      });
    });

    it('throws error when something went wrong during the intersection', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      payload.tilesetFilename = 'invalidTileset.json';

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, {} as unknown as Polygon);
      expect(response).toStrictEqual({ isValid: false, message: `An error caused during the validation of the intersection` });
    });

    it('returns error string when footprint does not intersect to model polygon', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      payload.metadata.footprint = createFootprint('Region');

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: false, message: ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL });
    });

    it('returns error string when footprint does not intersects enough with model polygon', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      configMock.get.mockReturnValue(100);
      validationManager = new ValidationManager(
        configMock,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint('WrongVolume'));
      expect(response.isValid).toBe(false);
      expect(response.message).toContain('The footprint intersectection with the model');
    });

    it('throws error if product type is invalid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();
      payload.metadata.productType = faker.animal.bear() as unknown as ProductType;

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: true }); // For now, the validation will be only warning. so it's true
    });

    it('returns true when product id is undefined', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      payload.metadata.productId = undefined;

      catalogMock.isProductIdExist.mockResolvedValue(false);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({ isValid: true });
    });

    it('returns false when product id doesnt exists', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      catalogMock.isProductIdExist.mockResolvedValue(false);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({
        isValid: false,
        message: `Record with productId: ${payload.metadata.productId} doesn't exist!`,
      });
    });

    it('returns false when classification is not a valid', async () => {
      const payload = createIngestionPayload();
      payload.modelPath = createMountedModelPath();

      catalogMock.isProductIdExist.mockResolvedValue(true);
      lookupTablesMock.getClassifications.mockResolvedValue(['NonValidClassification']);

      const response = await validationManager.isMetadataValid(payload.metadata, createFootprint());
      expect(response).toStrictEqual({
        isValid: false,
        message: `classification is not a valid value.. Optional values: ${'NonValidClassification'}`,
      });
    });
  });

  describe('isPathExist tests', () => {
    it.each([
      { path: createMountedModelPath(), result: true },
      { path: join(createMountedModelPath(), createTilesetFileName()), result: true },
      { path: join(createMountedModelPath(), 'nonExistsFile.json'), result: false },
      { path: join('nonExistsFolder', createTilesetFileName()), result: false },
    ])('should check if sources exists and return true for %p', async (testInput: { path: string; result: boolean }) => {
      const response = await validationManager.isPathExist(testInput.path);
      expect(response).toBe(testInput.result);
    });
  });

  describe('getTilesetModelPolygon tests', () => {
    it.each([
      { path: join(createMountedModelPath('Sphere'), createTilesetFileName()), result: {} as Polygon },
      { path: join(createMountedModelPath('Region'), createTilesetFileName()), result: {} as Polygon },
      {
        path: join(createMountedModelPath('Box'), createTilesetFileName()),
        result: ERROR_METADATA_BOX_TILESET,
      },
      { path: join(createMountedModelPath(), 'invalidTileset3Dtiles.json'), result: ERROR_METADATA_BAD_FORMAT_TILESET },
      { path: join(createMountedModelPath(), 'invalidTileset.json'), result: ERROR_METADATA_ERRORED_TILESET },
    ])('should check if sources exists and return true for %p', async (testInput: { path: string; result: Polygon | string }) => {
      const fileContent: string = await readFile(testInput.path, { encoding: FILE_ENCODING });
      const failedReason: FailedReason = { outFailedReason: '' };
      const polygonResponse: Polygon | undefined = validationManager.getTilesetModelPolygon(fileContent, failedReason);
      /* eslint-disable */
      if (polygonResponse == undefined) {
        expect(failedReason!.outFailedReason).toBe(testInput.result);
      } else {
        expect(polygonResponse as Polygon).toBeDefined();
      }
      /* eslint-enable */
    });
  });

  describe('validateModelPath tests', () => {
    it('returns true when got valid model path', () => {
      const modelPath = createModelPath();

      const result = validationManager.isModelPathValid(modelPath, getBasePath());

      expect(result).toBe(true);
    });

    it('returns false when model path not in the agreed path', () => {
      const modelPath = 'some/path';

      const result = validationManager.isModelPathValid(modelPath, getBasePath());

      expect(result).toBe(false);
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

      const refReason: FailedReason = { outFailedReason: '' };
      const response = await validationManager.validateUpdate(identifier, payload, refReason);

      expect(response).toBe(true);
    });

    it('returns error if catalog dont contain the requested record', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      catalogMock.getRecord.mockResolvedValue(undefined);

      const refReason: FailedReason = { outFailedReason: '' };
      const response = await validationManager.validateUpdate(identifier, payload, refReason);

      expect(response).toBe(false);
      expect(refReason.outFailedReason).toBe(`Record with identifier: ${identifier} doesn't exist!`);
    });

    it('throws error when catalog services does not properly responded', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      catalogMock.getRecord.mockRejectedValue(new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, 'catalog error', true));

      const refReason: FailedReason = { outFailedReason: '' };
      const response = validationManager.validateUpdate(identifier, payload, refReason);

      await expect(response).rejects.toThrow('catalog error');
    });

    it('returns false when got dates are invalid', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      const record = createRecord();
      catalogMock.getRecord.mockResolvedValue(record);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.classification]);
      providerMock.getFile.mockResolvedValue(getTileset());

      payload.sourceDateStart = new Date(555);
      payload.sourceDateEnd = new Date(554);

      const refReason: FailedReason = { outFailedReason: '' };
      const response = await validationManager.validateUpdate(identifier, payload, refReason);

      expect(response).toBe(false);
      expect(refReason.outFailedReason).toBe(ERROR_METADATA_DATE);
    });

    it('returns false when footprint polygon scheme is invalid', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      const record = createRecord();
      catalogMock.getRecord.mockResolvedValue(record);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.classification]);
      providerMock.getFile.mockResolvedValue(getTileset());

      payload.footprint = createWrongFootprintCoordinates();
      payload.footprint.coordinates = [[[]]];

      const refReason: FailedReason = { outFailedReason: '' };
      const response = await validationManager.validateUpdate(identifier, payload, refReason);

      expect(response).toBe(false);
      expect(refReason.outFailedReason).toBe(
        `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type", "coordinates" and "BBOX" only. polygon: ${JSON.stringify(
          payload.footprint
        )}`
      );
    });

    it('returns false when classification is not a valid', async () => {
      const identifier = faker.string.uuid();
      const payload = createUpdatePayload();
      const record = createRecord();
      catalogMock.getRecord.mockResolvedValue(record);
      lookupTablesMock.getClassifications.mockResolvedValue(['NonValidClassification']);
      providerMock.getFile.mockResolvedValue(getTileset());

      const refReason: FailedReason = { outFailedReason: '' };
      const response = await validationManager.validateUpdate(identifier, payload, refReason);

      expect(response).toBe(false);
      expect(refReason.outFailedReason).toBe(`classification is not a valid value.. Optional values: ${'NonValidClassification'}`);
    });
  });

  describe('isPolygonValid', () => {
    it('returns true when Polygon is valid', async () => {
      const footprint = createFootprint('Region');
      const response = await validationManager.isPolygonValid(footprint);
      expect(response.isValid).toBe(true);
    });

    it('returns true when Polygon has BBOX', async () => {
      const footprint = createFootprint('Region');
      footprint.bbox = [
        34.4077734887818,
        31.454120054543704,
        34.4780703169442,
        31.5127352949048
      ];
      const response = await validationManager.isPolygonValid(footprint);
      expect(response.isValid).toBe(true);
    });

    it('returns false when Polygon is invalid', async () => {
      const footprint = createFootprint('Region');
      footprint.coordinates = [][0] as unknown as Position[][];
      const response = await validationManager.isPolygonValid(footprint);
      expect(response.isValid).toBe(false);
      expect(response.message).toContain(`Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type", "coordinates" and "BBOX" only.`);
    });
  });
});
