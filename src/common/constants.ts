import { readPackageJsonSync } from '@map-colonies/read-pkg';
import config from 'config';

const packageJsonData = readPackageJsonSync();
export const SERVICE_NAME = packageJsonData.name ?? 'unknown_service';
export const SERVICE_VERSION = packageJsonData.version ?? 'unknown_version';
export const DEFAULT_SERVER_PORT = 80;

export const NODE_VERSION = process.versions.node;

export const PROJECTIONS = {
  sphere: '+proj=geocent +datum=WGS84 +units=m +no_defs +type=crs',
  region: '+proj=longlat +datum=WGS84 +no_defs +type=crs',
};

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  PROVIDER: Symbol('Provider'),
  PROVIDER_CONFIG: Symbol('ProviderConfig'),
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
