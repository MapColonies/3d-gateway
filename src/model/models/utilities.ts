import { sep, relative } from 'node:path';
import { Polygon, Position } from 'geojson';
import config from 'config';

export const changeBasePathToPVPath = (modelPath: string): string => {
  const basePath = config.get<string>('paths.basePath');
  const pvPath = config.get<string>('paths.pvPath');
  const mountedPath = modelPath.replace(basePath, pvPath);
  return mountedPath;
};

export const removePvPathFromModelPath = (modelPath: string): string => {
  const configedPvPath = config.get<string>('paths.pvPath');
  const relativePathFromPvPToModel = relative(configedPvPath, modelPath);
  return relativePathFromPvPToModel;
};

export const replaceBackQuotesWithQuotes = (path: string): string => {
  return path.replaceAll('\\', sep);
};

export const convertStringToGeojson = (geojson: string): Polygon => {
  return JSON.parse(geojson) as Polygon;
};

export const convertPolygonTo2DPolygon = (polygon: Polygon): Polygon => {
  polygon.coordinates = polygon.coordinates.map((polygonInPolygon: Position[]) => {
    /* eslint-disable-next-line @typescript-eslint/no-magic-numbers */
    return polygonInPolygon.map((coordinate: Position) => coordinate.slice(0, 2));
  });
  return polygon;
};
