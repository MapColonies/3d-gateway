import { sep } from 'node:path';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import { ProductType } from '@map-colonies/mc-model-types';
import mockAxios from 'jest-mock-axios';
import { faker } from '@faker-js/faker';
import { register } from 'prom-client';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { AxiosError } from 'axios';
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
  getModelNameByPath,
  createWrongFootprintMixed2D3D,
  createFootprint,
  createRecord,
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { IngestionPayload, IngestionValidatePayload, ValidationResponse } from '../../../src/common/interfaces';
import {
  ERROR_METADATA_BOX_TILESET,
  ERROR_METADATA_ERRORED_TILESET,
  ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL,
  ERROR_METADATA_PRODUCT_NAME_UNIQUE,
} from '../../../src/validator/validationManager';
import { ERROR_STORE_TRIGGER_ERROR } from '../../../src/model/models/modelManager';
import { StoreTriggerPayload, StoreTriggerResponse } from '../../../src/externalServices/storeTrigger/interfaces';
import { StoreTriggerCall } from '../../../src/externalServices/storeTrigger/storeTriggerCall';
import { ModelRequestSender } from './helpers/requestSender';

describe('ModelController', function () {
  let requestSender: ModelRequestSender;
  beforeEach(function () {
    register.clear();
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
    });
    requestSender = new ModelRequestSender(app);
  });

  afterEach(function () {
    mockAxios.reset();
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('POST /models (createModel)', function () {
    describe('Happy Path 🙂', function () {
      it.each(['Sphere', 'Region', `nestedModelPath${sep}Region`])(
        'should return 201 status code and the added model for %p',
        async (testInput: string) => {
          const payload = createIngestionPayload(testInput);
          const expected: StoreTriggerPayload = {
            ...payload,
            metadata: createMetadata(),
            pathToTileset: getModelNameByPath(payload.modelPath),
            modelId: '',
          };
          const storeTriggerResult: StoreTriggerResponse = {
            jobId: faker.string.uuid(),
            status: OperationStatus.IN_PROGRESS,
          };
          mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
          mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
          mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
          mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

          const storeTriggerCallPostPayloadSpy = jest.spyOn(StoreTriggerCall.prototype, 'postPayload');

          const response = await requestSender.createModel(payload);

          expect(response.status).toBe(StatusCodes.CREATED);
          expect(storeTriggerCallPostPayloadSpy).toHaveBeenCalledTimes(1);
          /* eslint-disable @typescript-eslint/no-unsafe-assignment */
          expect(storeTriggerCallPostPayloadSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              modelId: expect.any(String),
              pathToTileset: expected.pathToTileset,
              tilesetFilename: expected.tilesetFilename,
              metadata: expect.anything(), // todo: check why expect.any(Layer3DMetadata) fails!
            })
          );
          expect(response).toSatisfyApiSpec();
        }
      );

      it('should return 201 status code if productType is not 3DPhotoRealistic', async function () {
        const payload = createIngestionPayload();
        payload.metadata.productType = ProductType.DTM;
        const storeTriggerResult: StoreTriggerResponse = {
          jobId: faker.string.uuid(),
          status: OperationStatus.IN_PROGRESS,
        };

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 201 status code if one of resolutionMeters is not defined', async function () {
        const payload = createIngestionPayload();
        payload.metadata.maxResolutionMeter = undefined;
        const storeTriggerResult: StoreTriggerResponse = {
          jobId: faker.string.uuid(),
          status: OperationStatus.IN_PROGRESS,
        };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 201 status code if footprint has 3D coordinates and pass footprint 2D to storeTrigger', async function () {
        const payload = createIngestionPayload('Sphere');
        payload.metadata.minResolutionMeter = 11;
        payload.metadata.producerName = 'aa';
        payload.metadata.footprint = createFootprint('Sphere', true);
        const expectedFootprint = createFootprint('Sphere', false);

        const storeTriggerResult: StoreTriggerResponse = {
          jobId: faker.string.uuid(),
          status: OperationStatus.IN_PROGRESS,
        };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

        const storeTriggerCallPostPayloadSpy = jest.spyOn(StoreTriggerCall.prototype, 'postPayload');

        const response = await requestSender.createModel(payload);

        expect(storeTriggerCallPostPayloadSpy).toHaveBeenCalledTimes(1);

        const subsetPostPayloadMetadata = {
          absoluteAccuracyLE90: payload.metadata.absoluteAccuracyLE90,
          accuracySE90: payload.metadata.accuracySE90,
          classification: payload.metadata.classification,
          creationDate: payload.metadata.creationDate?.toISOString(),
          description: payload.metadata.description,
          footprint: expectedFootprint,
          geographicArea: payload.metadata.geographicArea,
          heightRangeFrom: payload.metadata.heightRangeFrom,
          heightRangeTo: payload.metadata.heightRangeTo,
          maxAccuracyCE90: payload.metadata.maxAccuracyCE90,
          maxFlightAlt: payload.metadata.maxFlightAlt,
          maxResolutionMeter: payload.metadata.maxResolutionMeter,
          minFlightAlt: payload.metadata.minFlightAlt,
          minResolutionMeter: payload.metadata.minResolutionMeter,
          producerName: payload.metadata.producerName,
          productId: payload.metadata.productId,
          productName: payload.metadata.productName,
          productSource: '\\\\tmp\\tilesets\\models\\Sphere',
          productStatus: 'UNPUBLISHED',
          productType: '3DPhotoRealistic',
          productionSystem: payload.metadata.productionSystem,
          productionSystemVer: payload.metadata.productionSystemVer,
          region: payload.metadata.region,
          relativeAccuracySE90: payload.metadata.relativeAccuracySE90,
          sensors: payload.metadata.sensors,
          sourceDateEnd: `${payload.metadata.sourceDateEnd?.toISOString()}`,
          sourceDateStart: `${payload.metadata.sourceDateStart?.toISOString()}`,
          srsId: payload.metadata.srsId,
          srsName: payload.metadata.srsName,
          type: 'RECORD_3D',
          visualAccuracy: payload.metadata.visualAccuracy,
        };

        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        expect(storeTriggerCallPostPayloadSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            modelId: expect.any(String),
            pathToTileset: 'Sphere',
            tilesetFilename: 'tileset.json',
            metadata: subsetPostPayloadMetadata,
          })
        );

        expect(response.status).toBe(StatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥, createModel', function () {
      it('should return 500 status code if a network exception happens in store-trigger service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockRejectedValueOnce(new Error(ERROR_STORE_TRIGGER_ERROR));

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', ERROR_STORE_TRIGGER_ERROR);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 500 status code if a network exception happens in lookup-tables service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockRejectedValueOnce(new Error('there is a problem with lookup-tables'));
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with lookup-tables');
        expect(response).toSatisfyApiSpec();
      });

      it('should return 500 status code if got unexpected response from catalog service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.ACCEPTED });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'Problem with the catalog during validation of productId existence');
        expect(response).toSatisfyApiSpec();
      });

      it('should return 500 status code if a network exception happens in catalog service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockRejectedValueOnce(new Error('there is a problem with catalog'));

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path 😡', function () {
      it('should return 400 status code if modelPath is missing', async function () {
        const payload = {
          tilesetFilename: createTilesetFileName(),
          metadata: createMetadataWithoutProductSource(),
        };

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });

        const response = await requestSender.createModel(payload as unknown as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'modelPath'");
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if modelPath is invalid', async function () {
        const payload = createIngestionPayload();
        payload.modelPath = faker.word.sample();
        const basePath = getBasePath();

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Unknown model path! The model isn't in the agreed folder!, modelPath: ${payload.modelPath}, basePath: ${basePath}`
        );
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if tilesetFilename is missing', async function () {
        const payload = {
          modelPath: createModelPath(),
          metadata: createMetadataWithoutProductSource(),
        };

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });

        const response = await requestSender.createModel(payload as unknown as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'tilesetFilename'");
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if tilesetFilename is wrong', async function () {
        const payload = createIngestionPayload();
        payload.tilesetFilename = faker.word.sample();

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Unknown tileset name! The tileset file wasn't found!, tileset: ${payload.tilesetFilename} doesn't exist`
        );
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if tilesetFilename is not a valid json format', async function () {
        const payload = createIngestionPayload();
        payload.tilesetFilename = 'invalidTileset.json';

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_METADATA_ERRORED_TILESET);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if metadata is missing', async function () {
        const payload: IngestionValidatePayload = createIngestionPayload();
        delete payload.metadata;
        payload.metadata = undefined;

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: 'undefined' }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: payload });
        const response = await requestSender.createModel(payload as IngestionPayload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request/body must have required property 'metadata'");
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if metadata is invalid', async function () {
        const payload = createIngestionPayload();
        payload.metadata.absoluteAccuracyLE90 = 'fda' as unknown as number;

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message');
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if modelName is invalid', async function () {
        const payload = createIngestionPayload();
        const modelName = faker.word.sample();

        const originalModelPath = createModelPath(modelName);
        payload.modelPath = originalModelPath;

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message');
        expect((response.body as { message: string }).message).toContain(`Unknown model name! The model name isn't in the folder!, modelPath:`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if region is empty', async function () {
        const payload = createIngestionPayload();
        payload.metadata.region = [];

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/body/metadata/region must NOT have fewer than 1 items`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if sensors is empty', async function () {
        const payload = createIngestionPayload();
        payload.metadata.sensors = [];

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `request/body/metadata/sensors must NOT have fewer than 1 items`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if startDate is later than endDate', async function () {
        const payload = createIngestionPayload();
        payload.metadata.sourceDateEnd = faker.date.past();
        payload.metadata.sourceDateStart = faker.date.soon();

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `sourceStartDate should not be later than sourceEndDate`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if minResolution is greater than maxResolution', async function () {
        const payload = createIngestionPayload();
        payload.metadata.maxResolutionMeter = faker.number.int({ max: 8000 });
        payload.metadata.minResolutionMeter = payload.metadata.maxResolutionMeter + 1;

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `minResolutionMeter should not be bigger than maxResolutionMeter`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if footprint coordinates does not match', async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintCoordinates();

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Wrong polygon: ${JSON.stringify(payload.metadata.footprint)} the first and last coordinates should be equal`
        );
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if some coordinates of footprint are not in the same dimension`, async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintMixed2D3D();

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Wrong footprint! footprint's coordinates should be all in the same dimension 2D or 3D`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if footprint is in invalid schema', async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintSchema();

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `request/body/metadata/footprint/coordinates must NOT have fewer than 2 items, request/body/metadata/footprint/coordinates/0 must be number, request/body/metadata/footprint/type must be equal to one of the allowed values: LineString, request/body/metadata/footprint/coordinates must NOT have fewer than 2 items, request/body/metadata/footprint/coordinates/0 must NOT have more than 3 items, request/body/metadata/footprint/coordinates/0/0 must be number, request/body/metadata/footprint/coordinates/0/1 must be number, request/body/metadata/footprint/coordinates/0/2 must be number, request/body/metadata/footprint/coordinates/0/3 must be number, request/body/metadata/footprint/type must be equal to one of the allowed values: Polygon, request/body/metadata/footprint/type must be equal to one of the allowed values: MultiPoint, request/body/metadata/footprint/coordinates/0 must NOT have more than 3 items, request/body/metadata/footprint/coordinates/0/0 must be number, request/body/metadata/footprint/coordinates/0/1 must be number, request/body/metadata/footprint/coordinates/0/2 must be number, request/body/metadata/footprint/coordinates/0/3 must be number, request/body/metadata/footprint/type must be equal to one of the allowed values: MultiLineString, request/body/metadata/footprint/type must be equal to one of the allowed values: MultiPolygon, request/body/metadata/footprint/coordinates/0/0 must NOT have fewer than 4 items, request/body/metadata/footprint/coordinates/0/0/0 must be array, request/body/metadata/footprint/coordinates/0/0/1 must be array, request/body/metadata/footprint/coordinates/0/1 must NOT have fewer than 4 items, request/body/metadata/footprint/coordinates/0/1/0 must be array, request/body/metadata/footprint/coordinates/0/1/1 must be array, request/body/metadata/footprint/coordinates/0/2 must NOT have fewer than 4 items, request/body/metadata/footprint/coordinates/0/2/0 must be array, request/body/metadata/footprint/coordinates/0/2/1 must be array, request/body/metadata/footprint/coordinates/0/3 must NOT have fewer than 4 items, request/body/metadata/footprint/coordinates/0/3/0 must be array, request/body/metadata/footprint/coordinates/0/3/1 must be array, request/body/metadata/footprint must match a schema in anyOf`
        );
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if footprint does not intersect with tileset', async function () {
        const payload = createIngestionPayload('Sphere');
        payload.modelPath = createModelPath('Region');

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if tileset is in box format', async function () {
        const payload = createIngestionPayload('Box');
        payload.modelPath = createModelPath('Box');

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_METADATA_BOX_TILESET);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if tileset is not in 3D Tiles format', async function () {
        const payload = createIngestionPayload('WrongVolume');
        payload.modelPath = createModelPath('WrongVolume');

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Bad tileset format. Should be in 3DTiles format`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if classification is not a valid value', async function () {
        const payload = createIngestionPayload();
        const validClassification = faker.word.sample();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: validClassification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `classification is not a valid value.. Optional values: ${validClassification}`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if productId does not exist in DB', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with productId: ${payload.metadata.productId} doesn't exist!`);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if productName already exists in DB', async function () {
        const payload = createIngestionPayload();
        const dummyRecordWithSameName = createRecord();
        dummyRecordWithSameName.productName = payload.metadata.productName;
        const storeTriggerResult: StoreTriggerResponse = {
          jobId: faker.string.uuid(),
          status: OperationStatus.IN_PROGRESS,
        };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [dummyRecordWithSameName] });
        mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_METADATA_PRODUCT_NAME_UNIQUE);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if productName exists in existing job (from store trigger)', async function () {
        const payload = createIngestionPayload();
        const dummyRecordWithSameName = createRecord();
        dummyRecordWithSameName.productName = payload.metadata.productName;

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        const error = {
          status: StatusCodes.BAD_REQUEST.toString(),
          response: {
            status: StatusCodes.BAD_REQUEST,
          },
          message: ERROR_STORE_TRIGGER_ERROR,
          isAxiosError: true,
        };
        mockAxios.post.mockRejectedValueOnce(error as AxiosError);

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_STORE_TRIGGER_ERROR);
        expect(response).toSatisfyApiSpec();
      });
    });
  });

  describe('POST /models/validate', () => {
    describe('Happy Path 🙂', () => {
      it.each(['Sphere', 'Region'])('should return 200 status code for %p', async (testInput: string) => {
        const payload = createIngestionPayload(testInput);

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });

        const expectedResponse: ValidationResponse = {
          isValid: true,
        };
        const response = await requestSender.validate(payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toStrictEqual(expectedResponse);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 200 status with isValid=true for metadata=undefined', async function () {
        const payload: IngestionValidatePayload = createIngestionPayload();

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata!.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });

        const expectedResponse: ValidationResponse = {
          isValid: true,
        };
        delete payload.metadata;
        payload.metadata = undefined;
        const response = await requestSender.validate(payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toStrictEqual(expectedResponse);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 200 status code and isValid=false for Box', async function () {
        const testInput = 'Box';
        const payload = createIngestionPayload(testInput);
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });

        const expectedResponse: ValidationResponse = {
          isValid: false,
          message: ERROR_METADATA_BOX_TILESET,
        };
        const response = await requestSender.validate(payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toStrictEqual(expectedResponse);
        expect(response).toSatisfyApiSpec();
      });

      it('should return 200 status and isValid=false code for bad model', async function () {
        const testInput = 'Sphere';
        const payload = createIngestionPayload(testInput);
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        payload.modelPath = 'InvalidModelPath';

        const response = await requestSender.validate(payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect((response.body as { isValid: boolean }).isValid).toBe(false);
        expect((response.body as { message: string }).message).toContain(`Unknown model path! The model isn't in the agreed folder!`);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path 😡', function () {});

    describe('Sad Path 😥, validate', () => {
      it('should return 500 status code for connection error', async function () {
        const payload = createIngestionPayload('Sphere');

        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));
        mockAxios.get.mockRejectedValueOnce(new Error('Lookup error'));

        const response = await requestSender.validate(payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
        expect(response).toSatisfyApiSpec();
      });
    });
  });
});
