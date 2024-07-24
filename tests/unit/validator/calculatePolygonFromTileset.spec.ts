import { readFileSync } from 'node:fs';
import { Polygon } from 'geojson';
import { convertSphereFromXYZToWGS84, convertRegionFromRadianToDegrees } from '../../../src/validator/calculatePolygonFromTileset';
import { BoundingRegion, BoundingSphere, TileSetJson } from '../../../src/validator/interfaces';

describe('Calculate polygon from tileset', () => {
  describe('calculateSphere tests', () => {
    it('Should return sphere polygon', () => {
      const file: string = readFileSync('./tests/helpers/3DModels/Sphere/tileset.json', 'utf8');
      const shape: BoundingSphere = (JSON.parse(file) as TileSetJson).root.boundingVolume as BoundingSphere;
      const converted: string = readFileSync('./tests/helpers/3DModels/Sphere/convertedTileset.json', 'utf8');
      const expected: Polygon = JSON.parse(converted) as Polygon;

      const result = convertSphereFromXYZToWGS84(shape);

      expect(result).toStrictEqual(expected);
    });
  });

  describe('calculateRegion tests', () => {
    it('Should return region polygon', () => {
      const file: string = readFileSync('./tests/helpers/3DModels/Region/tileset.json', 'utf8');
      const shape: BoundingRegion = (JSON.parse(file) as TileSetJson).root.boundingVolume as BoundingRegion;
      const expected = {
        type: 'Polygon',
        coordinates: [
          [
            [34.42342907827327, 31.441092547914398],
            [34.59385538210898, 31.441092547914398],
            [34.59385538210898, 31.58376427595295],
            [34.42342907827327, 31.58376427595295],
            [34.42342907827327, 31.441092547914398],
          ],
        ],
      };

      const result = convertRegionFromRadianToDegrees(shape);

      expect(result).toStrictEqual(expected);
    });
  });
});
