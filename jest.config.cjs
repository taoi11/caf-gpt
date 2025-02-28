/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest to handle TypeScript
  preset: 'ts-jest/presets/js-with-ts-esm',
  
  // Indicate this project uses ESM
  extensionsToTreatAsEsm: ['.ts'],
  
  // Modern transformers to handle ESM
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  
  // Module settings for ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // Test environment settings
  testEnvironment: 'node',
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/client/**',
  ],
  
  // Other settings
  verbose: true,
  testTimeout: 10000,
}; 