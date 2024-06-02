import { OperationStatus } from '@map-colonies/mc-priority-queue';
import { Layer3DMetadata } from '@map-colonies/mc-model-types';

export interface StoreTriggerResponse {
  jobID: string;
  status: OperationStatus.IN_PROGRESS;
}

export interface StoreTriggerPayload {
  modelId: string;
  pathToTileset: string;
  tilesetFilename: string;
  metadata: Layer3DMetadata;
}
