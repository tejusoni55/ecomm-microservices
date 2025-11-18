// Jest configuration for users service
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/index.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
