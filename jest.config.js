/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test/jest.setup.js'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/test/**/*.test.ts'],
  
  // Handle module resolution for TypeScript
  moduleNameMapper: {
    // Map paths for module resolution
    '^@server/(.*)$': '<rootDir>/src/server/$1',
    '^@utils/(.*)$': '<rootDir>/src/server/utils/$1',
    '^@test/(.*)$': '<rootDir>/src/test/$1'
  },
  
  // Handle ES Module interop
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|node-fetch|fetch-blob|data-uri-to-buffer|formdata-polyfill|web-streams-polyfill)/)',
  ],
  
  // No longer need specific ESM settings
  resolver: undefined
}; 