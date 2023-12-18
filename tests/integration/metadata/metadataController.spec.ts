import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { StatusCodes } from 'http-status-codes';
import mockAxios from 'jest-mock-axios';
import { randSentence, randWord } from '@ngneat/falso';
import { ILookupOption } from '../../../src/externalServices/lookupTables/interfaces';
import {
  createUuid,
  createUpdatePayload,
  createUpdateStatusPayload,
} from '../../helpers/helpers';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { MetadataRequestSender } from './helpers/requestSender';

describe('MiddlewareController', function () {
  let requestSender: MetadataRequestSender;
  beforeEach(function () {
    const app = getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new MetadataRequestSender(app);
  });

  afterEach(function () {
    mockAxios.reset();
  });

  describe('POST /metadata/update/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        const expected = randSentence();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toBe(expected);
      });
    });

    describe('Bad Path 😡', function () {
      it(`should return 400 status code if classification is not valid`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        const classification = randWord();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: classification }] as ILookupOption[] });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `classification is not a valid value.. Optional values: ${classification}`);
      });

      it(`should return 400 status code if record does not exist in catalog`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with identifier: ${identifier} doesn't exist!`);
      });
    });

    describe('Sad Path 😥', function () {
      it(`should return 500 status code if during validation, catalog didn't return as expected`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'Problem with the catalog during validation of record existence');
      });

      it(`should return 500 status code if lookup-tables is not working properly`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockRejectedValueOnce(new Error('lookup-tables error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with lookup-tables');
      });

      it(`should return 500 status code if catalog is not working properly`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
      });

      it(`should return 500 status code if during sending request, catalog didn't return as expected`, async function () {
        const identifier = createUuid();
        const payload = createUpdatePayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.get.mockResolvedValueOnce({ data: [{ value: payload.classification }] as ILookupOption[] });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateMetadata(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
      });
    });
  });

  describe('POST /metadata/update/status/{identifier}', function () {
    describe('Happy Path 🙂', function () {
      it(`should return 200 status code and metadata if payload is valid`, async function () {
        const identifier = createUuid();
        const payload = createUpdateStatusPayload();
        const expected = randSentence();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.OK, data: expected });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.body).toBe(expected);
      });
    });

    describe('Bad Path 😡', function () {
      it(`should return 400 status code if record does not exist in catalog`, async function () {
        const identifier = createUuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', `Record with identifier: ${identifier} doesn't exist!`);
      });
    });

    describe('Sad Path 😥', function () {
      it(`should return 500 status code if during validation, catalog didn't return as expected`, async function () {
        const identifier = createUuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'Problem with the catalog during validation of record existence');
      });

      it(`should return 500 status code if catalog is not working properly`, async function () {
        const identifier = createUuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockRejectedValueOnce(new Error('catalog error'));

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is a problem with catalog');
      });

      it(`should return 500 status code if during sending request, catalog didn't return as expected`, async function () {
        const identifier = createUuid();
        const payload = createUpdateStatusPayload();
        mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });
        mockAxios.patch.mockResolvedValueOnce({ status: StatusCodes.CONFLICT });

        const response = await requestSender.updateStatus(identifier, payload);

        expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(response.body).toHaveProperty('message', 'there is an error with catalog');
      });
    });
  });
});
