import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { trace } from '@opentelemetry/api';
import { faker } from '@faker-js/faker';
import { createStoreTriggerPayload } from '../../../helpers/helpers';
import { StoreTriggerCall } from '../../../../src/externalServices/storeTrigger/storeTriggerCall';
import { StoreTriggerResponse } from '../../../../src/externalServices/storeTrigger/interfaces';
import { StatusCodes } from 'http-status-codes';
import { AxiosError } from 'axios';

let storeTrigger: StoreTriggerCall;

describe('StoreTriggerCall', () => {
  beforeEach(() => {
    storeTrigger = new StoreTriggerCall(config, trace.getTracer('testTracer'), jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postPayload Function', () => {
    it('resolves without errors', async () => {
      const storeTriggerUrl = config.get<string>('externalServices.storeTrigger');
      const request = createStoreTriggerPayload(faker.word.sample());
      const expected: StoreTriggerResponse = {
        jobId: faker.string.uuid(),
        status: OperationStatus.IN_PROGRESS,
      };
      mockAxios.post.mockResolvedValue({ data: expected });

      const created = await storeTrigger.postPayload(request);

      expect(mockAxios.post).toHaveBeenCalledWith(`${storeTriggerUrl}/ingestion`, request);
      expect(created).toMatchObject(expected);
    });

    it('rejects if service is not available', async () => {
      const request = createStoreTriggerPayload(faker.word.sample());
      mockAxios.post.mockRejectedValueOnce(new Error('store-trigger is not available'));

      const createPromise = storeTrigger.postPayload(request);

      await expect(createPromise).rejects.toThrow('store-trigger is not available');
    });

    it('should return 400 status code if productName exists in existing job (from store trigger BAD_REQUEST response)', async function () {
      const storeTriggerUrl = config.get<string>('externalServices.storeTrigger');
      const request = createStoreTriggerPayload(faker.word.sample());
      const expected: StoreTriggerResponse = {
        jobId: faker.string.uuid(),
        status: OperationStatus.IN_PROGRESS,
      };
      const error = {
        status: StatusCodes.BAD_REQUEST.toString(),
        response: {
          status: StatusCodes.BAD_REQUEST
        },
        message: "ERROR_STORE_TRIGGER_ERROR",
        isAxiosError: true,
      };
      mockAxios.post.mockRejectedValueOnce(error as AxiosError);

      const createPromise = storeTrigger.postPayload(request);

      await expect(createPromise).rejects.toThrow('ERROR_STORE_TRIGGER_ERROR');
    });
  });
});
