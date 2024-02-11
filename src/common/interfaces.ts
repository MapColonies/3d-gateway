import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { S3 } from 'aws-sdk';
import { Polygon } from 'geojson';

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IngestionPayload {
  modelPath: string;
  tilesetFilename: string;
  metadata: Omit<Layer3DMetadata, 'productSource'>;
}

export interface UpdatePayload {
  productName?: string;
  sourceDateStart?: Date;
  sourceDateEnd?: Date;
  footprint?: Polygon;
  description?: string;
  creationDate?: Date;
  minResolutionMeter?: number;
  maxResolutionMeter?: number;
  maxAccuracyCE90?: number;
  absoluteAccuracyLE90?: number;
  accuracySE90?: number;
  relativeAccuracySE90?: number;
  visualAccuracy?: number;
  heightRangeFrom?: number;
  heightRangeTo?: number;
  classification?: string;
  producerName?: string;
  minFlightAlt?: number;
  maxFlightAlt?: number;
  geographicArea?: string;
  keywords?: string;
}

export interface UpdateStatusPayload {
  productStatus: string;
}

export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface Provider {
  getFile: (fileName: string) => Promise<Buffer>;
}

export type ProviderConfig = S3Config;

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpointUrl: string;
  bucket: string;
  region: string;
  tls: boolean;
  forcePathStyle: boolean;
  maxAttempts: number;
  sigVersion: string;
  storageClass?: S3.StorageClass;
}
