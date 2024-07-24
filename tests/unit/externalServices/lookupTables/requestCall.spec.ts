import mockAxios from 'jest-mock-axios';
import config from 'config';
import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { LookupTablesCall } from '../../../../src/externalServices/lookupTables/lookupTablesCall';
import { ILookupOption, LookupTablesConfig } from '../../../../src/externalServices/lookupTables/interfaces';
import { createLookupOptions } from '../../../helpers/helpers';

let lookupTables: LookupTablesCall;

describe('lookupTablesCall', () => {
  beforeEach(() => {
    lookupTables = new LookupTablesCall(config, trace.getTracer('testTracer'), jsLogger({ enabled: false }));
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getClassifications Function', () => {
    it('Get the classification without errors', async () => {
      const lookupTablesConfig = config.get<LookupTablesConfig>('externalServices.lookupTables');
      const lookupOptions: ILookupOption[] = createLookupOptions(2);
      const expected = [lookupOptions[0].value, lookupOptions[1].value];
      mockAxios.get.mockResolvedValue({ data: lookupOptions });

      const result = await lookupTables.getClassifications();

      expect(mockAxios.get).toHaveBeenCalledWith(`${lookupTablesConfig.url}/${lookupTablesConfig.subUrl}/classification`);
      expect(result).toMatchObject(expected);
    });

    it('rejects if service is not available', async () => {
      mockAxios.get.mockRejectedValue(new Error('there is a problem with lookup-tables'));

      const createPromise = lookupTables.getClassifications();

      await expect(createPromise).rejects.toThrow('there is a problem with lookup-tables');
    });
  });
});
