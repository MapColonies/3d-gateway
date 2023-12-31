import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { randWord } from '@ngneat/falso';
import { createStoreTriggerPayload, createUuid } from '../../../helpers/helpers';
import { StoreTriggerCall } from '../../../../src/externalServices/storeTrigger/requestCall';
import { StoreTriggerConfig, StoreTriggerResponse } from '../../../../src/externalServices/storeTrigger/interfaces';

let storeTrigger: StoreTriggerCall;

describe('StoreTriggerCall', () => {
  beforeEach(() => {
    storeTrigger = new StoreTriggerCall(config, jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postPayload Function', () => {
    it('resolves without errors', async () => {
      const storeTriggerConfig = config.get<StoreTriggerConfig>('storeTrigger');
      const request = createStoreTriggerPayload(randWord());
      const expected: StoreTriggerResponse = {
        jobID: createUuid(),
        status: OperationStatus.IN_PROGRESS,
      };
      mockAxios.post.mockResolvedValue({ data: expected });

      const created = await storeTrigger.postPayload(request);

      expect(mockAxios.post).toHaveBeenCalledWith(`${storeTriggerConfig.url}/${storeTriggerConfig.subUrl}`, request);
      expect(created).toMatchObject(expected);
    });

    it('rejects if service is not available', async () => {
      const request = createStoreTriggerPayload(randWord());
      mockAxios.post.mockRejectedValue(new Error('store-trigger is not available'));

      const createPromise = storeTrigger.postPayload(request);

      await expect(createPromise).rejects.toThrow('store-trigger is not available');
    });
  });
});
