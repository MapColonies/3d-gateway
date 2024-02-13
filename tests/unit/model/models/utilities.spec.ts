import config from 'config';
import * as utils from '../../../../src/model/models/utilities';

describe('utilities tests', () => {
  describe('removeFootprintSpaces tests', () => {
    it('Should return footprint without spaces', () => {
      const footprint = '         { "key":"v a l u e"  }   ';
      const expected = { key: 'v a l u e' };

      const result = utils.convertStringToGeojson(footprint);

      expect(result).toStrictEqual(expected);
    });
  });

  describe('changeBasePathToPVPath tests', () => {
    it('Should return mounted path', () => {
      const basePath: string = config.get<string>('paths.basePath') + '\\model\\path';
      const expected: string = config.get<string>('paths.pvPath') + '\\model\\path';

      const result: string = utils.changeBasePathToPVPath(basePath);

      expect(result).toBe(expected);
    });
  });

  describe('removePvPathFromModelPath tests', () => {
    it('Should return model name from base path', () => {
      const modelName = 'model\\path';
      const modelPath = config.get<string>('paths.pvPath') + `/${modelName}`;

      const result: string = utils.removePvPathFromModelPath(modelPath);

      expect(result).toBe(modelName);
    });
  });

  describe('replaceBackQuotesWithQuotes tests', () => {
    it('Should replace all the back quotes to quotes', () => {
      const path = 'path\\to\\model\\with\\quotes';
      const expected = 'path/to/model/with/quotes';

      const result: string = utils.replaceBackQuotesWithQuotes(path);

      expect(result).toBe(expected);
    });
  });
});
