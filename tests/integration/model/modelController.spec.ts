import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import { ProductType } from '@map-colonies/mc-model-types';
import mockAxios from 'jest-mock-axios';
import { faker } from '@faker-js/faker';
import { register } from 'prom-client';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
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
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { IngestionPayload, IngestionValidatePayload, ValidationResponse } from '../../../src/common/interfaces';
import {
  ERROR_METADATA_BOX_TILESET,
  ERROR_METADATA_ERRORED_TILESET,
  ERROR_METADATA_FOOTPRINT_FAR_FROM_MODEL,
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
      describe('Sphere', function () {
        it('should return 201 status code and the added model', async function () {
          const payload = createIngestionPayload('Sphere');
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
        });
      });

      describe('Region', function () {
        it('should return 201 status code and the added model', async function () {
          const payload = createIngestionPayload('Region');
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
        });
      });

      it('should return 201 status code if productType is not 3DPhotoRealistic', async function () {
        const payload = createIngestionPayload();
        payload.metadata.productType = ProductType.DTM;
        const storeTriggerResult: StoreTriggerResponse = {
          jobId: faker.string.uuid(),
          status: OperationStatus.IN_PROGRESS,
        };

        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
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
        mockAxios.post.mockResolvedValueOnce({ data: storeTriggerResult });

        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.CREATED);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥, createModel', function () {
      it('should return 500 status code if a network exception happens in store-trigger service', async function () {
        const payload = createIngestionPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
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
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Wrong polygon: ${JSON.stringify(payload.metadata.footprint)} the first and last coordinates should be equal`
        );
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if footprint is in invalid schema', async function () {
        const payload = createIngestionPayload();
        payload.metadata.footprint = createWrongFootprintSchema();

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Invalid polygon provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. polygon: ${JSON.stringify(
            payload.metadata.footprint
          )}`
        );
        expect(response).toSatisfyApiSpec();
      });

      it('should return 400 status code if footprint does not intersect with tileset', async function () {
        const payload = createIngestionPayload('Sphere');
        payload.modelPath = createModelPath('Region');

        const expected = { ...payload, metadata: createMetadata(), modelPath: createMountedModelPath('Sphere'), modelId: '' };
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.metadata.classification }] as ILookupOption[] });
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
        mockAxios.post.mockResolvedValueOnce({ data: expected });
        const response = await requestSender.createModel(payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with productId: ${payload.metadata.productId} doesn't exist!`);
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
