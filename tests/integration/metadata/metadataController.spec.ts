import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import mockAxios from 'jest-mock-axios';
import { faker } from '@faker-js/faker';
import config from 'config';
import { RecordStatus } from '@map-colonies/types';
import { ILookupOption } from '../../../src/externalServices/lookupTables/interfaces';
import {
  createUpdatePayload,
  createUpdateStatusPayload,
  createWrongFootprintCoordinates,
  createWrongFootprintSchema,
  createRecord,
  createWrongFootprintMixed2D3D,
  createFootprint,
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { S3Helper } from '../../helpers/s3Helper';
import { S3Config } from '../../../src/common/interfaces';
import { extractLink } from '../../../src/validator/extractPathFromLink';
import { CatalogCall } from '../../../src/externalServices/catalog/catalogCall';
import { ERROR_METADATA_PRODUCT_NAME_UNIQUE } from '../../../src/validator/validationManager';
import { MetadataRequestSender } from './helpers/requestSender';

describe('MetadataController', function () {
  let requestSender: MetadataRequestSender;
  const s3Config = config.get<S3Config>('S3');
  let s3Helper: S3Helper;

  beforeAll(function () {
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
    });
    requestSender = new MetadataRequestSender(app);
    s3Helper = new S3Helper(s3Config);
  });

  beforeEach(async () => {
    await s3Helper.initialize();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    await s3Helper.terminate();
    mockAxios.reset();
  });

  describe('PATCH /metadata/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`Should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const expected = createRecord();
        const record = createRecord();
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 200 status code if record product name is my name (unique)`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const expected = createRecord();
        const record = createRecord();
        record.id = identifier;
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [record] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 200 status code and metadata if payload is valid and footprint is 3D and pass footprint 2D to catalog`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload('Sphere');
        payload.footprint = createFootprint('Sphere', true);
        const expectedFootprint = createFootprint('Sphere', false);
        const expected = createRecord();
        const record = createRecord();
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const catalogCallPatchPayloadSpy = jest.spyOn(CatalogCall.prototype, 'patchMetadata');
        const patchMetadataPayload = {
          productName: payload.productName,
          sourceDateStart: payload.sourceDateStart?.toISOString(),
          sourceDateEnd: payload.sourceDateEnd?.toISOString(),
          footprint: expectedFootprint,
          description: payload.description,
          creationDate: payload.creationDate?.toISOString(),
          minResolutionMeter: payload.minResolutionMeter,
          maxResolutionMeter: payload.maxResolutionMeter,
          maxAccuracyCE90: payload.maxAccuracyCE90,
          absoluteAccuracyLE90: payload.absoluteAccuracyLE90,
          accuracySE90: payload.accuracySE90,
          relativeAccuracySE90: payload.relativeAccuracySE90,
          visualAccuracy: payload.visualAccuracy,
          heightRangeFrom: payload.heightRangeFrom,
          heightRangeTo: payload.heightRangeTo,
          classification: payload.classification,
          producerName: payload.producerName,
          maxFlightAlt: payload.maxFlightAlt,
          minFlightAlt: payload.minFlightAlt,
          geographicArea: payload.geographicArea,
        };

        const response = await requestSender.updateMetadata(identifier, payload);

        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        expect(catalogCallPatchPayloadSpy).toHaveBeenCalledTimes(1);
        expect(catalogCallPatchPayloadSpy).toHaveBeenCalledWith(expect.any(String), patchMetadataPayload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path 😡', function () {
      it(`Should return 400 status code if classification is not valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const classification = faker.word.sample();
        const record = createRecord();
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: classification }] as ILookupOption[] });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `classification is not a valid value.. Optional values: ${classification}`);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if the footprint is not in the footprint schema`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        payload.footprint = createWrongFootprintSchema();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `request/body/footprint/coordinates must NOT have fewer than 2 items, request/body/footprint/type must be equal to one of the allowed values: LineString, request/body/footprint/type must be equal to one of the allowed values: Polygon, request/body/footprint/type must be equal to one of the allowed values: MultiPoint, request/body/footprint/type must be equal to one of the allowed values: MultiLineString, request/body/footprint/type must be equal to one of the allowed values: MultiPolygon, request/body/footprint must match a schema in anyOf`
        );
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if the first and the last coordinates of footprint are not the same`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        payload.footprint = createWrongFootprintCoordinates();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          `Wrong polygon: ${JSON.stringify(payload.footprint)} the first and last coordinates should be equal`
        );
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if some coordinates of footprint are not in the same dimension`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        payload.footprint = createWrongFootprintMixed2D3D();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Wrong footprint! footprint's coordinates should be all in the same dimension 2D or 3D`);
        expect(response).toSatisfyApiSpec();
      });

      it('Should return 400 status code if startDate is later than endDate', async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        payload.sourceDateEnd = faker.date.past();
        payload.sourceDateStart = faker.date.soon();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `sourceStartDate should not be later than sourceEndDate`);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if record does not exist in catalog`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ data: undefined });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with identifier: ${identifier} doesn't exist!`);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if record product name already exists in catalog`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const expected = createRecord();
        const record = createRecord();
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });

        const clonedRecordWithSameNameAsPayload = { ...record, productName: payload.productName };
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [clonedRecordWithSameNameAsPayload] });

        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', ERROR_METADATA_PRODUCT_NAME_UNIQUE);
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 400 status code if record product status is 'Being-Deleted'`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const expected = createRecord();
        const record = createRecord();
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        record.productStatus = RecordStatus.BEING_DELETED;
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Can't update record that is being deleted`);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥', function () {
      it(`Should return 500 status code if lookup-tables is not working properly`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.get.mockRejectedValueOnce(new Error('lookup-tables error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with lookup-tables');
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 500 status code if catalog is not working properly when getting record`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 500 status code if during sending request, catalog didn't return as expected on patch`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.BAD_REQUEST, data: [] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'Problem with catalog find');
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 500 status code if during sending request, catalog didn't return as expected on find`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        const linkUrl = extractLink(record.links);
        await s3Helper.createFile(linkUrl, true);
        mockAxios.post.mockResolvedValueOnce({ status: StatusCodes.OK, data: [] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 500 status code if the link is not valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        record.links = faker.word.sample();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', `Link extraction failed`);
        expect(response).toSatisfyApiSpec();
      });
    });
  });

  describe('PATCH /metadata/status/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`Should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        const expected = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Bad Path 😡', function () {
      it(`Should return 400 status code if record does not exist in catalog`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ data: undefined });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with identifier: ${identifier} doesn't exist!`);
        expect(response).toSatisfyApiSpec();
      });
    });

    describe('Sad Path 😥', function () {
      it(`Should return 500 status code if catalog is not working properly`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
        expect(response).toSatisfyApiSpec();
      });

      it(`Should return 500 status code if during sending request, catalog didn't return as expected`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
        expect(response).toSatisfyApiSpec();
      });
    });
  });
});
