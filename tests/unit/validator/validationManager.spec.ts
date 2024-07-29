import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { ProductType } from '@map-colonies/mc-model-types';
import { Polygon } from 'geojson';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { ValidationManager } from '../../../src/validator/validationManager';
import { IngestionPayload, SourcesValidationResponse } from '../../../src/common/interfaces';
import {
  basePath as helpersBasePath,
  createMetadata,
  createModelPath,
  createTilesetFileName,
  createMountedModelPath,
  createWrongFootprintCoordinates,
  createFootprint,
  createWrongFootprintSchema,
  createRecord,
  createUpdatePayload,
  getTileset,
  createValidateSourcesPayload,
} from '../../helpers/helpers';
import { configMock, lookupTablesMock, jsLoggerMock, catalogMock, providerMock } from '../../helpers/mockCreator';
import { AppError } from '../../../src/common/appError';
import { FILE_ENCODING } from '../../../src/common/constants';

describe('ValidationManager', () => {
  let validationManager: ValidationManager;

  beforeEach(() => {
    configMock.get.mockReturnValueOnce(helpersBasePath);
    validationManager = new ValidationManager(
      configMock,
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

  describe('sourcesValid tests', () => {
    describe('sourcesValid tests', () => {
      it.each(['Sphere', 'Region'])('should check if sources are valid and return true for %p', async (testInput: string) => {
        const payload = createValidateSourcesPayload(testInput);

        const response = await validationManager.sourcesValid(payload);
        const expectedResponse: SourcesValidationResponse = {
          isValid: true,
        };
        expect(response).toStrictEqual(expectedResponse);
      });
    });

    it('should check if sources are valid and return false for Box tileset', async () => {
      const payload = createValidateSourcesPayload('Box');

      const response = await validationManager.sourcesValid(payload);
      const expectedResponse: SourcesValidationResponse = {
        isValid: false,
        message: `BoundingVolume of box is not supported yet... Please contact 3D team.`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if modelPath is invalid', async () => {
      const payload = createValidateSourcesPayload();

      payload.modelPath = 'invalidModelName';
      const response = await validationManager.sourcesValid(payload);
      const expectedResponse: SourcesValidationResponse = {
        isValid: false,
        message: `Unknown model name! The model name isn't in the folder!, modelPath: ${payload.modelPath}`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if TilesetJson is invalid', async () => {
      const payload = createValidateSourcesPayload();

      payload.tilesetFilename = 'invalidTilesetFilename';
      const response = await validationManager.sourcesValid(payload);
      const expectedResponse: SourcesValidationResponse = {
        isValid: false,
        message: `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`,
      };
      expect(response).toStrictEqual(expectedResponse);
    });

    it('should check if sources exists and return false if TilesetJson is invalid JSON', async () => {
      const payload = createValidateSourcesPayload();

      payload.tilesetFilename = 'invalidTileset.json';
      const response = await validationManager.sourcesValid(payload);
      const fullPath = join(`${payload.modelPath}`, `${payload.tilesetFilename}`);
      const expectedResponse: SourcesValidationResponse = {
        isValid: false,
        message: `File '${fullPath}' tileset validation failed`,
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

  describe('validateModelName tests', () => {
    it('returns true when got valid model name', () => {
      const modelPath = createMountedModelPath();

      const result = validationManager.validateModelPath(modelPath);

      expect(result).toBe(true);
    });

    it('returns error string when got model name that is not in the agreed folder', () => {
      const modelName = faker.word.sample();

      const result = validationManager.validateModelPath(modelName);

      expect(result).toContain(`Unknown model path! The model isn't in the agreed folder!`);
    });
  });

  describe('validateTilesetJson tests', () => {
    it('returns true when the file in tilesetFilename exists is a valid JSON', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };

      const result = validationManager['validateTilesetJson'](payload.modelPath, payload.tilesetFilename);

      expect(result).toBe(true);
    });

    it('returns error string when the file in tilesetFilename does not exists', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: faker.word.sample(),
        metadata: createMetadata(),
      };

      const result = validationManager['validateTilesetJson'](payload.modelPath, payload.tilesetFilename);

      expect(result).toBe(`Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`);
    });

    it('returns error string when the file is not a valid JSON', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: 'invalidTileset.json',
        metadata: createMetadata(),
      };
      const result = validationManager['validateTilesetJson'](payload.modelPath, payload.tilesetFilename);

      expect(result).toBe(`${payload.tilesetFilename} file that was provided isn't in a valid json format!`);
    });
  });

  describe('validateProductType tests', () => {
    it('returns true without warnings when got valid productType', () => {
      validationManager = new ValidationManager(
        configMock,
        jsLoggerMock as never,
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const modelName = createModelPath();
      const productType = ProductType.PHOTO_REALISTIC_3D;

      const response = validationManager['validateProductType'](productType, modelName);

      expect(response).toBe(true);
      expect(jsLoggerMock.warn).not.toHaveBeenCalled();
    });

    it('returns true with warnings when got invalid productType', () => {
      validationManager = new ValidationManager(
        configMock,
        jsLoggerMock as never,
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const modelName = createModelPath();
      const productType = ProductType.DSM;
      jsLoggerMock.warn.mockReturnValue('');

      const response = validationManager['validateProductType'](productType, modelName);

      expect(response).toBe(true);
      expect(jsLoggerMock.warn).toHaveBeenCalled();
    });
  });

  describe('validatePolygon tests', () => {
    it('returns true when the polygon is valid', () => {
      const footprint = createFootprint();

      const result = validationManager['validatePolygon'](footprint);

      expect(result).toBe(true);
    });

    it('returns error string when the polygon is not invalid schema', () => {
      const footprint = createWrongFootprintSchema();

      const result = validationManager['validatePolygon'](footprint);
      expect(result).toBe(
        `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. polygon: ${JSON.stringify(
          footprint
        )}`
      );
    });

    it('returns error string when the first and last coordinate are different', () => {
      const footprint = createWrongFootprintCoordinates();

      const result = validationManager['validatePolygon'](footprint);

      expect(result).toBe(`Wrong polygon: ${JSON.stringify(footprint)} the first and last coordinates should be equal`);
    });
  });

  describe('validateIntersection tests', () => {
    it('throws error when something went wrong during the intersection', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: 'invalidTileset.json',
        metadata: createMetadata(),
      };
      const fileContent = faker.word.sample();

      const result = () => {
        validationManager['validateIntersection'](fileContent, payload.metadata.footprint as Polygon, payload.metadata.productName!);
      };

      expect(result).toThrow(AppError);
    });

    describe('test tileset as sphere', () => {
      it('returns true when footprint is close to tileset json', () => {
        const payload: IngestionPayload = {
          modelPath: createMountedModelPath('Sphere'),
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadata(),
        };

        const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
        const fileContent = readFileSync(tilesetPath, 'utf8');

        const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint as Polygon, payload.metadata.productName!);

        expect(result).toBe(true);
      });

      it('returns error string when footprint is not intersect to tileset json file', () => {
        const payload: IngestionPayload = {
          modelPath: createMountedModelPath('Sphere'),
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadata(),
        };
        payload.metadata.footprint = createFootprint('Region');
        const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
        const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

        const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint, payload.metadata.productName!);

        expect(result).toBe(`Wrong footprint! footprint's coordinates is not even close to the model!`);
      });
    });

    describe('test tileset as region', () => {
      it('returns true when footprint is close to tileset json', () => {
        const payload: IngestionPayload = {
          modelPath: createMountedModelPath('Region'),
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadata(),
        };
        payload.metadata.footprint = createFootprint('Region');
        const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
        const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

        const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint, payload.metadata.productName!);

        expect(result).toBe(true);
      });

      it('returns error string when footprint is not intersect to tileset json file', () => {
        const payload: IngestionPayload = {
          modelPath: createMountedModelPath('Region'),
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadata(),
        };
        payload.metadata.footprint = createFootprint();
        const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
        const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

        const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint, payload.metadata.productName!);

        expect(result).toBe(`Wrong footprint! footprint's coordinates is not even close to the model!`);
      });
    });

    it('returns error string when tileset is a BoundingVolume of Box', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath('Box'),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      payload.metadata.footprint = createWrongFootprintCoordinates();
      const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
      const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

      const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint, payload.metadata.productName!);

      expect(result).toBe(`BoundingVolume of box is not supported yet... Please contact 3D team.`);
    });

    it('returns error string when tileset is in wrong BoundingVolume', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath('WrongVolume'),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      payload.metadata.footprint = createWrongFootprintCoordinates();
      const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
      const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

      const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint, payload.metadata.productName!);

      expect(result).toBe(`Bad tileset format. Should be in 3DTiles format`);
    });

    it('returns false when footprint is not intersected enough with tileset json', () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      configMock.get.mockReturnValue(100);
      validationManager = new ValidationManager(
        configMock,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const tilesetPath = `${payload.modelPath}/${payload.tilesetFilename}`;
      const fileContent = readFileSync(tilesetPath, FILE_ENCODING);

      const result = validationManager['validateIntersection'](fileContent, payload.metadata.footprint as Polygon, payload.metadata.productName!);

      expect(result).toContain('The footprint intersectection with the model');
    });
  });

  describe('validateDates tests', () => {
    it('returns true when start date is earlier than end date', () => {
      const startDate = new Date(2021, 11, 12, 7);
      const endDate = new Date(2022, 11, 12, 8);

      const result = validationManager['validateDates'](startDate, endDate);

      expect(result).toBe(true);
    });

    it('returns false when end date is earlier than start date', () => {
      const startDate = new Date(2022, 11, 12, 8);
      const endDate = new Date(2022, 11, 12, 7);

      const result = validationManager['validateDates'](startDate, endDate);

      expect(result).toBe('sourceStartDate should not be later than sourceEndDate');
    });
  });

  describe('validateProductID tests', () => {
    it('returns string error when productID does not exist in catalog', async () => {
      const productID = faker.string.uuid();
      catalogMock.isProductIdExist.mockResolvedValue(false);

      const result = await validationManager['validateProductID'](productID);

      expect(result).toBe(`Record with productId: ${productID} doesn't exist!`);
    });

    it('returns true when productID exists in catalog', async () => {
      const productID = faker.string.uuid();
      catalogMock.isProductIdExist.mockResolvedValue(true);

      const result = await validationManager['validateProductID'](productID);

      expect(result).toBe(true);
    });

    it('throws error when there is a problem with catalog', async () => {
      const productID = faker.string.uuid();
      catalogMock.isProductIdExist.mockRejectedValue(new Error('error'));

      const result = async () => {
        await validationManager['validateProductID'](productID);
      };

      await expect(result).rejects.toThrow(new Error('error'));
    });
  });

  describe('validateResolutionMeter tests', () => {
    it('returns true when one of them is undefined', () => {
      const option = faker.datatype.boolean();
      const minResolutionMeter = option ? faker.number.int({ max: 8000 }) : undefined;
      const maxResolutionMeter = minResolutionMeter === undefined ? faker.number.int({ max: 8000 }) : undefined;

      const result = validationManager['validateResolutionMeter'](minResolutionMeter, maxResolutionMeter);

      expect(result).toBe(true);
    });

    it('returns true when minResolutionMeter is smaller than maxResolutionMeter', () => {
      const minResolutionMeter = faker.number.int({ max: 7999 });
      const maxResolutionMeter = faker.number.int({ min: minResolutionMeter, max: 8000 });

      const result = validationManager['validateResolutionMeter'](minResolutionMeter, maxResolutionMeter);

      expect(result).toBe(true);
    });

    it('returns false when minResolutionMeter is bigger than maxResolutionMeter', () => {
      const maxResolutionMeter = faker.number.int({ max: 7999 });
      const minResolutionMeter = maxResolutionMeter + 1;

      const result = validationManager['validateResolutionMeter'](minResolutionMeter, maxResolutionMeter);

      expect(result).toBe('minResolutionMeter should not be bigger than maxResolutionMeter');
    });
  });

  describe('validateClassification tests', () => {
    it('returns true when classification exists in lookup-tables', async () => {
      const classification = faker.word.sample();
      lookupTablesMock.getClassifications.mockResolvedValue([classification]);

      const result = await validationManager['validateClassification'](classification);

      expect(result).toBe(true);
    });

    it('returns false when classification does not exist in lookup-tables', async () => {
      const classification = faker.word.sample();
      const optionalClassifications = [`${faker.word.sample()}-1`, `${faker.word.sample()}-2`];
      lookupTablesMock.getClassifications.mockResolvedValue(optionalClassifications);

      const result = await validationManager['validateClassification'](classification);

      expect(result).toBe(`classification is not a valid value.. Optional values: ${optionalClassifications.join()}`);
    });

    it('throws error when there is an error in lookup-tables', async () => {
      const classification = faker.word.sample();
      lookupTablesMock.getClassifications.mockRejectedValue(new Error('lookup-tables service is not available'));

      const result = async () => {
        await validationManager['validateClassification'](classification);
      };

      await expect(result).rejects.toThrow(Error('lookup-tables service is not available'));
    });
  });

  describe('validateIngestion', () => {
    it('returns true when got all functions valid', async () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      catalogMock.isProductIdExist.mockResolvedValue([payload.metadata.productId]);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);
      configMock.get.mockReturnValue(20); // for limit test
      validationManager = new ValidationManager(
        configMock,
        jsLogger({ enabled: false }),
        trace.getTracer('testTracer'),
        lookupTablesMock as never,
        catalogMock as never,
        providerMock
      );
      const response = await validationManager.validateIngestion(payload);

      expect(response).toBe(true);
    });

    it('returns true when got unfamiliar ProductType', async () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      payload.metadata.productType = ProductType.DSM;
      catalogMock.isProductIdExist.mockResolvedValue([payload.metadata.productId]);
      lookupTablesMock.getClassifications.mockResolvedValue([payload.metadata.classification]);

      const response = await validationManager.validateIngestion(payload);

      expect(response).toBe(true);
    });

    it('returns error string when has one invalid function', async () => {
      const payload: IngestionPayload = {
        modelPath: faker.word.sample(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };

      const response = await validationManager.validateIngestion(payload);

      expect(typeof response).toBe('string');
    });

    it('throws error when one of the external services does not properly responded', async () => {
      const payload: IngestionPayload = {
        modelPath: createMountedModelPath(),
        tilesetFilename: createTilesetFileName(),
        metadata: createMetadata(),
      };
      catalogMock.isProductIdExist.mockRejectedValue(new AppError('error', StatusCodes.INTERNAL_SERVER_ERROR, 'lookup-tables error', true));

      const response = validationManager.validateIngestion(payload);

      await expect(response).rejects.toThrow('lookup-tables error');
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
