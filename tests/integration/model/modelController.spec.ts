import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import { ProductType, RecordStatus } from '@map-colonies/mc-model-types';
import mockAxios from 'jest-mock-axios';
import { randFutureDate, randNumber, randPastDate, randWord } from '@ngneat/falso';
import { ILookupOption } from '../../../src/externalServices/lookupTables/interfaces';
import {
  createMetadata,
  createMetadataWithoutProductSource,
  createModelPath,
  createMountedModelPath,
  createIngestionPayload,
  createTilesetFileName,
  createWrongFootprintCoordinates,
  createWrongFootprintSchema,
  getBasePath,
  createUuid,
  createFakeDeleteResponse,
  createRecord,
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { IngestionPayload } from '../../../src/common/interfaces';
import { ModelRequestSender } from './helpers/requestSender';

describe('ModelController', function () {
  let requestSender: ModelRequestSender;
  beforeEach(function () {
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new ModelRequestSender(app);
  });

  afterEach(function () {
    mockAxios.reset();
  });

  describe('POST /models', function () {
    describe('Happy Path 🙂', function () {
      describe('Sphere', function () {
        it('should return 201 status code and the added model', async function () {
          const payload = createIngestionPayload('Sphere');
          const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
          mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
          mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
          mockAxios.post.mockResolvedValueOnce({ data: expected });

          const response = await requestSender.createModel(payload);

          expect(response.status).toBe(StatusCodes.CREATED);
          expect(response.body).toHaveProperty('modelPath', expected.modelPath);
          expect(response.body).toHaveProperty('tilesetFilename', payload.tilesetFilename);
          expect(response.body).toHaveProperty('metadata');
          expect(response.body).toHaveProperty('modelId');
        });
      });

      describe('Region', function () {
        it('should return 201 status code and the added model', async function () {
          const payload = createIngestionPayload('Region');
          const expected = { ...payload, metadata: createMetadata('Region'), modelPath: createMountedModelPath('Region'), modelId: '' };
          mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
          mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
          mockAxios.post.mockResolvedValueOnce({ data: expected });

          const response = await requestSender.createModel(payload);

          expect(response.status).toBe(StatusCodes.CREATED);
          expect(response.body).toHaveProperty('modelPath', expected.modelPath);
          expect(response.body).toHaveProperty('tilesetFilename', payload.tilesetFilename);
          expect(response.body).toHaveProperty('metadata');
          expect(response.body).toHaveProperty('modelId');
        });
      });

      it('should return 201 status code if productType is not 3DPhotoRealistic', async function () {
        const payload = createIngestionPayload();
        payload.metadata.productType = ProductType.DTM;
        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.CREATED);
      });

      it('should return 201 status code if one of resolutionMeters is not defined', async function () {
        const payload = createIngestionPayload();
        payload.metadata.maxResolutionMeter = undefined;
        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.CREATED);
      });
    });

    describe('Bad Path 😡', function () {
      it('should return 400 status code if modelPath is missing', async function () {
        const payload = {
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadataWithoutProductSource(),
        };

        const response = await requestSender.createModel(payload as unknown as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'modelPath'");
      });

      it('should return 400 status code if modelPath is invalid', async function () {
        const payload = createIngestionPayload();
        payload.modelPath = randWord();
        const basePath = getBasePath();

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Unknown model path! The model isn't in the agreed folder!, sourcePath: ${payload.modelPath}, basePath: ${basePath}`
        );
      });

      it('should return 400 status code if tilesetFilename is missing', async function () {
        const payload = {
          modelPath: createModelPath(),
          metadata: createMetadataWithoutProductSource(),
        };

        const response = await requestSender.createModel(payload as unknown as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'tilesetFilename'");
      });

      it('should return 400 status code if tilesetFilename is wrong', async function () {
        const payload = createIngestionPayload();
        payload.tilesetFilename = randWord();

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`
        );
      });

      it('should return 400 status code if tilesetFilename is not a valid json format', async function () {
        const payload = createIngestionPayload();
        payload.tilesetFilename = 'invalidTileset.json';

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `${payload.tilesetFilename} file that was provided isn't in a valid json format!`);
      });

      it('should return 400 status code if metadata is missing', async function () {
        const payload = {
          modelPath: createModelPath('Sphere'),
          tilesetFilename: createTilesetFileName(),
        };

        const response = await requestSender.createModel(payload as unknown as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'metadata'");
      });

      it('should return 400 status code if metadata is invalid', async function () {
        const payload = createIngestionPayload();
        payload.metadata.absoluteAccuracyLE90 = 'fda' as unknown as number;

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message');
      });

      it('should return 400 status code if modelName is invalid', async function () {
        const payload = createIngestionPayload();
        const modelName = randWord();
        payload.modelPath = createModelPath(modelName);

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Unknown model name! The model name isn't in the folder!, modelPath: ${createMountedModelPath(modelName)}`
        );
      });

      it('should return 400 status code if region is empty', async function () {
        const payload = createIngestionPayload();
        payload.metadata.region = [];

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/body/metadata/region must NOT have fewer than 1 items`);
      });

      it('should return 400 status code if sensors is empty', async function () {
        const payload = createIngestionPayload();
        payload.metadata.sensors = [];

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/body/metadata/sensors must NOT have fewer than 1 items`);
      });

      it('should return 400 status code if startDate is later than endDate', async function () {
        const payload = createIngestionPayload();
        payload.metadata.sourceDateEnd = randPastDate();
        payload.metadata.sourceDateStart = randFutureDate();

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `sourceStartDate should not be later than sourceEndDate`);
      });

      it('should return 400 status code if minResolution is greater than maxResolution', async function () {
        const payload = createIngestionPayload();
        payload.metadata.maxResolutionMeter = randNumber({ max: 8000 });
        payload.metadata.minResolutionMeter = payload.metadata.maxResolutionMeter + 1;

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `minResolutionMeter should not be bigger than maxResolutionMeter`);
      });

      it('should return 400 status code if footprint coordinates does not match', async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintCoordinates();

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Wrong footprint: ${JSON.stringify(payload.metadata.footprint)} the first and last coordinates should be equal`
        );
      });

      it('should return 400 status code if footprint is in invalid schema', async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintSchema();

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Invalid footprint provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. footprint: ${JSON.stringify(
            payload.metadata.footprint
          )}`
        );
      });

      it('should return 400 status code if footprint does not intersect with tileset', async function () {
        const payload = createIngestionPayload('Sphere');
        payload.modelPath = createModelPath('Region');

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Wrong footprint! footprint's coordinates is not even close to the model!`);
      });

      it('should return 400 status code if tileset is in box format', async function () {
        const payload = createIngestionPayload('Box');
        payload.modelPath = createModelPath('Box');

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `BoundingVolume of box is not supported yet... Please contact 3D team.`);
      });

      it('should return 400 status code if tileset is not in 3D Tiles format', async function () {
        const payload = createIngestionPayload('WrongVolume');
        payload.modelPath = createModelPath('WrongVolume');

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Bad tileset format. Should be in 3DTiles format`);
      });

      it('should return 400 status code if classification is not a valid value', async function () {
        const payload = createIngestionPayload();
        const validClassification = randWord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: validClassification }] as ILookupOption[] });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `classification is not a valid value.. Optional values: ${validClassification}`);
      });

      it('should return 400 status code if productId does not exist in DB', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with productId: ${payload.metadata.productId} doesn't exist!`);
      });
    });

    describe('Sad Path 😥', function () {
      it('should return 500 status code if a network exception happens in store-trigger service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockRejectedValueOnce(new Error('store-trigger is not available'));

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'store-trigger service is not available');
      });

      it('should return 500 status code if a network exception happens in lookup-tables service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockRejectedValueOnce(new Error('there is a problem with lookup-tables'));

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with lookup-tables');
      });

      it('should return 500 status code if got unexpected response from catalog service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.ACCEPTED });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'Problem with the catalog during validation of productId existence');
      });

      it('should return 500 status code if a network exception happens in catalog service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockRejectedValueOnce(new Error('there is a problem with catalog'));

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
      });
    });
  });

  describe('DELETE /models/:identifier', function () {
    describe('Happy Path 🙂', function () {
      it('Should return 200 status code and the deleted model', async function () {
        const expected = createFakeDeleteResponse();
        const identifier = createUuid();
        const record = createRecord();

        mockAxios.get.mockResolvedValue({ status: StatusCodes.OK, data: record });
        mockAxios.post.mockResolvedValue({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.deleteModel(identifier);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toEqual(expected);
      });
    });

    describe('Bad Path 😡', function () {
      it('should return 400 status code if identifier does not exist in catalog', async function () {
        const identifier = createUuid();

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: undefined });

        const response = await requestSender.deleteModel(identifier);

        expect(response.body).toHaveProperty('message', `Identifier ${identifier} wasn't found on DB`);
        expect(response.status).toBe(StatusCodes.NOT_FOUND);
      });

      it('Should return 400 status code is product status is PUBLISHED', async function () {
        const identifier = createUuid();
        const record = createRecord();
        record.productStatus = RecordStatus.PUBLISHED;

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });

        const response = await requestSender.deleteModel(identifier);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Model ${record.productName} is PUBLISHED. The model must be UNPUBLISHED to be deleted!`);
      });
    });
  });

  describe('Sad Path 😥', function () {
    it('should return 500 status code if a network exception happens in store-trigger service', async function () {
      const identifier = createUuid();
      const record = createRecord();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
      mockAxios.post.mockRejectedValueOnce(new Error('store-trigger is not available'));

      const response = await requestSender.deleteModel(identifier);

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('message', 'store-trigger service is not available');
    });

    it('should return 500 status code if exception happens in catalog service', async function () {
      const identifier = createUuid();
      const expected = createFakeDeleteResponse();
      mockAxios.get.mockRejectedValueOnce({
        response: { status: StatusCodes.INTERNAL_SERVER_ERROR, data: new Error('catalog service is not available') },
      });
      mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

      const response = await requestSender.deleteModel(identifier);

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
    });
  });
});
