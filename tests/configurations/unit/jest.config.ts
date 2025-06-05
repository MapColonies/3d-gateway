module.exports = {
  transform: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
  coverageReporters: ['text', 'html'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!*/node_modules/',
    '!/vendor/**',
    '!*/common/**',
    '!**/controllers/**',
    '!**/routes/**',
    '!<rootDir>/src/*',
  ],
  coveragePathIgnorePatterns: ['<rootDir>/src/providers'],
  coverageDirectory: '<rootDir>/coverage',
  reporters: [
    'default',
    ['jest-html-reporters', { multipleReportsUnitePath: './reports', pageTitle: 'unit', publicPath: './reports', filename: 'unit.html' }],
  ],
  rootDir: '../../../.',
  setupFiles: ['<rootDir>/tests/configurations/jest.setup.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: -9,
    },
  },
};
