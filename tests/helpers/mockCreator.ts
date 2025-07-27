import { S3Config } from '../../src/common/interfaces';

export const fakeS3Config = (bucket: string): S3Config => {
  return {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endpointUrl: 'http://127.0.0.1:9000',
    bucket,
    region: 'us-east-1',
    forcePathStyle: true,
    sslEnabled: false,
    maxAttempts: 3,
  };
};

export const storeTriggerMock = {
  startIngestion: jest.fn(),
  startDeleteJob: jest.fn(),
};

export const validationManagerMock = {
  isMetadataValidForIngestion: jest.fn(),
  isModelPathValid: jest.fn(),
  isPathExist: jest.fn(),
  validateUpdate: jest.fn(),
  getTilesetModelPolygon: jest.fn(),
  isPolygonValid: jest.fn(),
};

export const configMock = {
  get: jest.fn(),
  has: jest.fn(),
};

export const providerMock = {
  getFile: jest.fn(),
};

export const lookupTablesMock = {
  getClassifications: jest.fn(),
};

export const jsLoggerMock = {
  warn: jest.fn(),
  debug: jest.fn(),
};

export const catalogMock = {
  getRecord: jest.fn(),
  findRecords: jest.fn(),
  isProductIdExist: jest.fn(),
  patchMetadata: jest.fn(),
  changeStatus: jest.fn(),
};
