import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { randWord } from '@ngneat/falso';
import { createStoreTriggerPayload, createUuid } from '../../../helpers/helpers';
import { StoreTriggerCall } from '../../../../src/externalServices/storeTrigger/requestCall';
import { StoreTriggerConfig, StoreTriggerResponse } from '../../../../src/externalServices/storeTrigger/interfaces';
import { configMock } from '../../../helpers/mockCreator';

let storeTrigger: StoreTriggerCall;

describe('StoreTriggerCall', () => {
  beforeEach(() => {
    storeTrigger = new StoreTriggerCall(config, jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postPayload Function', () => {
    const storeTriggerConfig = config.get<StoreTriggerConfig>('externalServices.storeTrigger');

    describe('should post without errors', () => {
      it('when DR is not enabled', async () => {
        const request = createStoreTriggerPayload(randWord());
        const expected: StoreTriggerResponse = {
          jobID: createUuid(),
          status: OperationStatus.IN_PROGRESS,
        };
        mockAxios.post.mockResolvedValue({ data: expected });

        const created = await storeTrigger.postPayload(request);

        expect(mockAxios.post).toHaveBeenCalledWith(`${storeTriggerConfig.url}/ingestion`, request);
        expect(created).toMatchObject(expected);
      });

      it('when DR is enabled', async () => {
        configMock.get.mockReturnValue({
          url: 'http://127.0.0.1:8080',
          dr: {
            enabled: true,
            url: 'http://127.0.0.1:8080',
          },
        });
        storeTrigger = new StoreTriggerCall(configMock, jsLogger({ enabled: false }));
        const request = createStoreTriggerPayload(randWord());
        const expected: StoreTriggerResponse = {
          jobID: createUuid(),
          status: OperationStatus.IN_PROGRESS,
        };
        mockAxios.post.mockResolvedValue({ data: expected });

        const created = await storeTrigger.postPayload(request);

        expect(mockAxios.post).toHaveBeenNthCalledWith(1, `${storeTriggerConfig.url}/ingestion`, request);
        expect(mockAxios.post).toHaveBeenNthCalledWith(2, `${storeTriggerConfig.dr.url}/ingestion`, request);
        expect(created).toMatchObject(expected);
      });
    });

    it('rejects if service is not available', async () => {
      const request = createStoreTriggerPayload(randWord());
      mockAxios.post.mockRejectedValue(new Error('store-trigger is not available'));

      const createPromise = storeTrigger.postPayload(request);

      await expect(createPromise).rejects.toThrow('store-trigger is not available');
    });
  });
});
