import { Polygon } from 'geojson';
import config from 'config';

export const changeBasePathToPVPath = (modelPath: string): string => {
  const basePath = config.get<string>('paths.basePath');
  const pvPath = config.get<string>('paths.pvPath');
  const mountedPath = modelPath.replace(basePath, pvPath);
  return mountedPath;
};

export const removePvPathFromModelPath = (modelPath: string): string => {
  const pvPath = config.get<string>('paths.pvPath');
  return modelPath.replace(`${pvPath}/`, '');
};

export const replaceBackQuotesWithQuotes = (path: string): string => {
  return path.replaceAll('\\', '/');
};

export const convertStringToGeojson = (geojson: string): Polygon => {
  return JSON.parse(geojson) as Polygon;
};
