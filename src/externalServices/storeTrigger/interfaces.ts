import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { Layer3DMetadata } from '@map-colonies/mc-model-types';

export interface StoreTriggerResponse {
  jobId: string;
  status: OperationStatus.IN_PROGRESS;
}

export interface StoreTriggerIngestionPayload {
  modelId: string;
  pathToTileset: string;
  tilesetFilename: string;
  metadata: Layer3DMetadata;
}

export interface StoreTriggerDeletePayload {
  modelId: string;
  productId: string; // resourceId in job
  productVersion: number;
  productName: string;
  productType: string;
  producerName: string;
}
