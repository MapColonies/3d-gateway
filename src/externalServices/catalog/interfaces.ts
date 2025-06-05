import { Layer3DMetadata, ProductType } from '@map-colonies/mc-model-types';

export interface MetadataParams {
  identifier: string;
}

export interface Record3D extends Layer3DMetadata {
  id: string;
  links: string;
}

export interface IFindRecordsPayload {
  id?: string;
  productId?: string;
  productName?: string;
  productType?: ProductType;
  creationDate?: string;
  sourceDateStart?: string;
  sourceDateEnd?: string;
  minResolutionMeter?: number;
  maxResolutionMeter?: number;
  maxAccuracyCE90?: number;
  absoluteAccuracyLE90?: number;
  accuracySE90?: number;
  relativeAccuracySE90?: number;
  visualAccuracy?: number;
  heightRangeFrom?: number;
  heightRangeTo?: number;
  srsId?: string;
  srsName?: string;
  classification?: string;
  productionSystem?: string;
  productionSystemVer?: string;
  producerName?: string;
  minFlightAlt?: number;
  maxFlightAlt?: number;
  geographicArea?: string;
  productStatus?: string;
}
