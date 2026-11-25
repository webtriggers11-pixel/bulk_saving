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
 * Never real SMS from a test run (FEAT-046 V2 P1). A developer .env may hold the TextBee
 * gateway keys; a suite that compiles AppModule without overriding NOTIFICATION_CHANNEL
 * would then bind the real channel, and its queue workers could text a random test number.
 */
// Blank, not deleted: ConfigModule re-reads .env when AppModule loads, and dotenv only fills
// keys absent from process.env. Blank counts as unset everywhere (validation, textbeeConfig).
process.env.TEXTBEE_API_KEY = '';
// FEAT-047: the suites request hundreds of codes a day (some on one phone, clearing the hourly
// ceiling between bursts); the daily caps would trip mid-run. Its behaviour is tested with explicit low limits in otp.service.spec.
process.env.OTP_DAILY_MAX = '9999999';
process.env.OTP_PHONE_DAILY_MAX = '9999999';
process.env.OTP_CLIENT_DAILY_MAX = '9999999';
process.env.TEXTBEE_DEVICE_ID = '';

/**
 * The suite's queues live under their own BullMQ prefix (CHORE-017). A dev server
 * (`nest start --watch`) on the same Redis consumes every queue it knows under the
 * default `bull` prefix — including the suite's OTP sends and notifications — so tests
 * waiting on a capturing channel waited for a job another process had already taken.
 */
process.env.BULLMQ_PREFIX = 'bull-test';

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
