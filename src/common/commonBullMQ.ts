import { StoreTriggerPayload } from "../externalServices/storeTrigger/interfaces";

export interface Data { 
  parameters: StoreTriggerPayload; 
  stage: Stage;
  percentage: number;
}

export const QUEUES = {
  jobsQueue: 'jobs',
  stagesQueue: 'stages',
  taskQueues: {
    storeTriggerQueue: 'listPaths',
    fileSyncerQueue: 'tilesCopying',
    jobSyncerQueue: 'send2Catalog',
  }
}

export enum Stage {
  INITIALIZING = "Initializing",
  PROCESSING = "Processing",
  FINALIZING = "Finalizing",
}