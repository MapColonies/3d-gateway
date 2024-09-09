import { join, sep } from 'node:path';
import config from 'config';
import {
  convertStringToGeojson,
  changeBasePathToPVPath,
  removePvPathFromModelPath,
  replaceBackQuotesWithQuotes,
} from '../../../../src/model/models/utilities';

describe('utilities tests', () => {
  describe('removeFootprintSpaces tests', () => {
    it('Should return footprint without spaces', () => {
      const footprint = '         { "key":"v a l u e"  }   ';
      const expected = { key: 'v a l u e' };

      const result = convertStringToGeojson(footprint);

      expect(result).toStrictEqual(expected);
    });
  });

  describe('changeBasePathToPVPath tests', () => {
    it('Should return mounted path', () => {
      const basePath: string = config.get<string>('paths.basePath') + '\\model\\path';
      const expected: string = config.get<string>('paths.pvPath') + '\\model\\path';

      const result: string = changeBasePathToPVPath(basePath);

      expect(result).toBe(expected);
    });
  });

  describe('removePvPathFromModelPath tests', () => {
    it('Should return model name from base path', () => {
      const modelName = 'model\\path';
      const modelPath = join(config.get<string>('paths.pvPath'), sep, `${modelName}`);
      const result: string = removePvPathFromModelPath(modelPath);

      expect(result).toBe(modelName);
    });
  });

  describe('replaceBackQuotesWithQuotes tests', () => {
    it('Should replace all the back quotes to quotes', () => {
      const path = 'path\\to\\model\\with\\quotes';
      const expected = join('path', sep, 'to', sep, 'model', sep, 'with', sep, 'quotes');
      const result: string = replaceBackQuotesWithQuotes(path);

      expect(result).toBe(expected);
    });
  });
});
