import { Layer3DMetadata } from '@map-colonies/mc-model-types';
import { commonS3FullV1Type } from '@map-colonies/schemas';
import { Polygon } from 'geojson';

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

export interface Provider {
  getFile: (filePath: string) => Promise<string>;
}

export type ProviderConfig = commonS3FullV1Type;

export interface LogContext {
  fileName: string;
  class: string;
  function?: string;
}
