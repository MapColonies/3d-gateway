import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import mockAxios from 'jest-mock-axios';
import { faker } from '@faker-js/faker';
import config from 'config';
import { ILookupOption } from '../../../src/externalServices/lookupTables/interfaces';
import {
  createUpdatePayload,
  createUpdateStatusPayload,
  createWrongFootprintCoordinates,
  createWrongFootprintSchema,
  createRecord,
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { S3Helper } from '../../helpers/s3Helper';
import { S3Config } from '../../../src/common/interfaces';
import { extractLink } from '../../../src/validator/extractPathFromLink';
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
    await s3Helper.terminate();
    mockAxios.reset();
  });

  describe('PATCH /metadata/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`Should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const expected = faker.word.words();
        const record = createRecord();
        await s3Helper.createFile(extractLink(record.links), true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toBe(expected);
      });
    });

    describe('Bad Path 😡', function () {
      it(`Should return 400 status code if classification is not valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const classification = faker.word.sample();
        const record = createRecord();
        await s3Helper.createFile(extractLink(record.links), true);
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: classification }] as ILookupOption[] });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `classification is not a valid value.. Optional values: ${classification}`);
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
          `Invalid footprint provided. Must be in a GeoJson format of a Polygon. Should contain "type" and "coordinates" only. footprint: ${JSON.stringify(
            payload.footprint
          )}`
        );
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
          `Wrong footprint: ${JSON.stringify(payload.footprint)} the first and last coordinates should be equal`
        );
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
      });

      it(`Should return 400 status code if record does not exist in catalog`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ data: undefined });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with identifier: ${identifier} doesn't exist!`);
      });
    });

    describe('Sad Path 😥', function () {
      it(`Should return 500 status code if lookup-tables is not working properly`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        await s3Helper.createFile(extractLink(record.links), true);
        mockAxios.get.mockRejectedValueOnce(new Error('lookup-tables error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with lookup-tables');
      });

      it(`Should return 500 status code if catalog is not working properly`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
      });

      it(`Should return 500 status code if during sending request, catalog didn't return as expected`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdatePayload();
        const record = createRecord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: record });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        await s3Helper.createFile(extractLink(record.links), true);
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
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
      });
    });
  });

  describe('PATCH /metadata/status/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`Should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        const expected = faker.word.words();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.body).toBe(expected);
        expect(response.status).toBe(StatusCodes.OK);
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
      });

      it(`Should return 500 status code if during sending request, catalog didn't return as expected`, async function () {
        const identifier = faker.string.uuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK, data: createRecord() });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
      });
    });
  });
});
