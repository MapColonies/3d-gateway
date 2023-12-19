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

export const lookupTablesMock = {
  getClassifications: jest.fn(),
};

export const jsLoggerMock = {
  warn: jest.fn(),
};

export const catalogMock = {
  isRecordExist: jest.fn(),
  isProductIdExist: jest.fn(),
  patchMetadata: jest.fn(),
  changeStatus: jest.fn(),
};
