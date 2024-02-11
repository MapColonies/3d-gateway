import { readPackageJsonSync } from '@map-colonies/read-pkg';
import config from 'config';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'unknown_service';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

export const PROJECTIONS = {
  sphere: '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs',
  region: '+proj=longlat +datum=WGS84 +no_defs +type=crs',
};

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  PROVIDER: Symbol('Provider'),
};
/* eslint-disable @typescript-eslint/naming-convention */

export const mountDirs = [
  {
    physical: config.get<string>('paths.pvPath'),
    displayName: config.get<string>('paths.basePath'),
    includeFilesExt: ['json'],
  },
];

export const footprintSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['Polygon'] },
    coordinates: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
        },
      },
    },
  },
  required: ['type', 'coordinates'],
  additionalProperties: false,
};
