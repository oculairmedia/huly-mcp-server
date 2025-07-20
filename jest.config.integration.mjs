export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/__tests__/integration/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/worktrees/'],
  modulePathIgnorePatterns: ['/worktrees/'],
  testTimeout: 60000, // 60 seconds for integration tests
  maxWorkers: 1, // Run integration tests sequentially
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup.js'],
};