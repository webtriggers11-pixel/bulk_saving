/**
 * Minimal .env loader for the Jest process (no dependency on dotenv).
 * Ensures integration tests read DATABASE_URL / REDIS_* from apps/backend/.env
 * before any test module evaluates its connection config.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const contents = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  for (const line of contents.split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch {
  // No .env present — fall back to the test defaults below.
}

// Pin the test environment (Jest only defaults it when unset): boot-time side
// effects such as the round close-job reconciler are skipped under test, because
// parallel suites share one DB.
process.env.NODE_ENV = 'test';

/**
 * Pin the DEV OTP echo OFF for the suite (CHORE-002, ADR-0016), whatever the local
 * .env says. A developer running with `OTP_DEV_LOG=true` must not silently turn the
 * "the OTP never appears in an API response" assertions into vacuous ones. Tests that
 * exercise the echo set the variable themselves and restore it.
 */
process.env.OTP_DEV_LOG = 'false';

/**
 * Test-only fixtures. Guarantee the vars that boot-time validation (and the auth
 * services) require are present even when no .env file exists (e.g. CI), so
 * integration tests can boot. These are throwaway test values, never real secrets.
 */
const TEST_DEFAULTS: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5442/bulk_saving?schema=public',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6399',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789',
  JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789',
  OTP_HASH_SECRET: 'test-otp-hash-secret-0123456789',
};
for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
