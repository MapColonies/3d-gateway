import { join, sep } from 'node:path';
import config from 'config';
import {
  convertStringToGeojson,
  changeBasePathToPVPath,
  removePvPathFromModelPath,
  replaceBackQuotesWithQuotes,
  convertPolygonTo2DPolygon,
  getSimplifiedProductName,
} from '../../../../src/model/models/utilities';
import { createFootprint } from '../../../helpers/helpers';

describe('utilities tests', () => {
  describe('removeFootprintSpaces tests', () => {
    it('Should return footprint without spaces', () => {
      const footprint = '         { "key":"v a l u e"  }   ';
      const expected = { key: 'v a l u e' };

      const result = convertStringToGeojson(footprint);

      expect(result).toStrictEqual(expected);
    });
  });

  describe('convertPolygonTo2DPolygon tests', () => {
    it('Should return footprint 2D from 3D', () => {
      const footprint3D = createFootprint('Sphere', true);
      const expectedFootprint2D = createFootprint('Sphere', false);

      const result = convertPolygonTo2DPolygon(footprint3D);
      expect(result).toStrictEqual(expectedFootprint2D);
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

  describe('getSimplifiedProductName tests', () => {
    it('Should trim productName', () => {
      const inputProductName = '   trimmed    ';
      const expectedProductName = 'trimmed';
      const result: string = getSimplifiedProductName(inputProductName);
      expect(result).toBe(expectedProductName);
    });

    it('Should remove spaces inside productName', () => {
      const inputProductName = '   tr   i m     m     e   dsadsad  dsada1!  ';
      const expectedProductName = 'tr i m m e dsadsad dsada1!';
      const result: string = getSimplifiedProductName(inputProductName);
      expect(result).toBe(expectedProductName);
    });
  });
});
