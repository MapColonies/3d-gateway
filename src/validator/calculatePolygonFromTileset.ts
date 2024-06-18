/* eslint-disable @typescript-eslint/no-magic-numbers */
import { ellipse } from '@turf/turf';
import bboxPolygon from '@turf/bbox-polygon';
import * as proj4 from 'proj4';
import { BBox, Polygon } from 'geojson';
import { PROJECTIONS } from '../common/constants';
import { BoundingRegion, BoundingSphere } from './interfaces';

export const convertSphereFromXYZToWGS84 = (shape: BoundingSphere): Polygon => {
  // The center coords of the sphere in WGS84 (x, y)
  const coord: number[] = proj4.default(PROJECTIONS.sphere).inverse<number[]>(shape.sphere);

  // The radius of the sphere (from meters to kilometers)
  const radius: number = coord[3] / 1000;

  // The polygon of the tileset
  const model: Polygon = ellipse([coord[0], coord[1]], radius, radius, {}).geometry;
  return model;
};

export const convertRegionFromRadianToDegrees = (shape: BoundingRegion): Polygon => {
  const RADIAN2DEGREE: number = 180 / Math.PI;
  const coord: number[] = shape.region.slice(0, 4).map((x) => x * RADIAN2DEGREE);

  const model: Polygon = bboxPolygon(coord as BBox).geometry;
  return model;
};
