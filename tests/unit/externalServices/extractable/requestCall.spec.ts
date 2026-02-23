import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { trace } from '@opentelemetry/api';
import { ExtractableCall } from '../../../../src/externalServices/extractable-management/extractableCall';
let extractable: ExtractableCall;
describe('extractableCall tests', () => {
  const extractableUrl = config.get<string>('externalServices.extractable');

  beforeEach(() => {
    extractable = new ExtractableCall(config, jsLogger({ enabled: false }), trace.getTracer('testTracer'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isExtractableRecordExists Function', () => {
    it('Returns true when recordName exists in DB', async () => {
      const recordName = faker.string.uuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });

      const response = await extractable.isExtractableRecordExists(recordName);

      expect(mockAxios.get).toHaveBeenCalledWith(`${extractableUrl}/records/${recordName}`, { validateStatus: expect.any(Function) });
      expect(response).toBe(true);
    });

    it('Returns false when recordName does not exist in DB', async () => {
      const recordName = faker.string.uuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.NOT_FOUND });

      const response = await extractable.isExtractableRecordExists(recordName);

      expect(mockAxios.get).toHaveBeenCalledWith(`${extractableUrl}/records/${recordName}`, { validateStatus: expect.any(Function) });
      expect(response).toBe(false);
    });

    it('Rejects if got unexpected response from extractable', async () => {
      const recordName = faker.string.uuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.INTERNAL_SERVER_ERROR });

      const response = extractable.isExtractableRecordExists(recordName);

      expect(mockAxios.get).toHaveBeenCalledWith(`${extractableUrl}/records/${recordName}`, { validateStatus: expect.any(Function) });
      await expect(response).rejects.toThrow('Unexpected response from extractable service');
    });

    it('rejects if service is not available', async () => {
      const recordName = faker.string.uuid();
      mockAxios.get.mockRejectedValueOnce(new Error('extractable is not available'));

      const response = extractable.isExtractableRecordExists(recordName);

      await expect(response).rejects.toThrow('Failed to query extractable service');
    });

    it('uses validateStatus that always returns true', async () => {
      const recordName = faker.string.uuid();
      mockAxios.get.mockResolvedValueOnce({ status: StatusCodes.OK });

      await extractable.isExtractableRecordExists(recordName);

      const [, options] = mockAxios.get.mock.calls[0];
      const validateStatus = options.validateStatus;

      expect(typeof validateStatus).toBe('function');
      expect(validateStatus(200)).toBe(true);
      expect(validateStatus(404)).toBe(true);
      expect(validateStatus(500)).toBe(true);
      expect(validateStatus(0)).toBe(true);
    });
  });
});
