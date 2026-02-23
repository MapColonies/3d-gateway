import { Layer3DMetadata } from '@map-colonies/mc-model-types';

export interface MetadataParams {
  identifier: string;
}

export interface Record3D extends Layer3DMetadata {
  id: string;
  links: string;
}
