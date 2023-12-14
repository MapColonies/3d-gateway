export interface BoundingVolume {
  sphere?: number[];
  region?: number[];
  box?: number[];
}

export interface Root {
  boundingVolume: BoundingVolume;
}

export interface TileSetJson {
  root: Root;
}

export interface BoundingSphere {
  sphere: number[];
}

export interface BoundingRegion {
  region: number[];
}
