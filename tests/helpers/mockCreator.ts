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
  postPayload: jest.fn(),
};

export const validationManagerMock = {
  validateModelPath: jest.fn(),
  validateIngestion: jest.fn(),
  validateUpdate: jest.fn(),
  validateRecordExistence: jest.fn(),
};

export const configMock = {
  get: jest.fn(),
  has: jest.fn(),
};

export const configProviderMock = {
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
  isProductIdExist: jest.fn(),
  patchMetadata: jest.fn(),
  changeStatus: jest.fn(),
};
