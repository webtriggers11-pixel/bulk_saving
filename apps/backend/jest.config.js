/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFiles: ['reflect-metadata', '<rootDir>/test/load-env.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  testEnvironment: 'node',
  testTimeout: 30000,
  // Serial by default (BUG-006). Every integration suite shares ONE Postgres and ONE
  // Redis (ADR-0006), so running files in parallel means suites interleave over the
  // same rows, the same BullMQ queues and the same reconcilers. That produced a
  // different intermittent failure on almost every back-to-back pair of runs — a 401
  // from a suite whose fixtures another had disturbed, a reconciler test whose job
  // another worker consumed, a delayed-job test starved of CPU. `--runInBand` in the
  // test script is what actually enforces it; this is here so the reason is findable.
  maxWorkers: 1,
};
