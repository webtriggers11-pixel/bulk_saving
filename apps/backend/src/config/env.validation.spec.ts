import { assertProductionSafe, validateEnv, type EnvironmentVariables } from './env.validation';

/** A config that passes the base schema, so these tests isolate the production rules. */
function env(overrides: Partial<EnvironmentVariables> = {}): EnvironmentVariables {
  return {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    JWT_ACCESS_SECRET: 'a-real-access-secret-value',
    JWT_REFRESH_SECRET: 'a-real-refresh-secret-value',
    OTP_HASH_SECRET: 'a-real-otp-hash-secret-value',
    NODE_ENV: 'production',
    CORS_ORIGINS: 'https://app.example.com',
    ...overrides,
  } as EnvironmentVariables;
}

/**
 * CHORE-007 / ADR-0020. Every rule here guards a failure that is SILENT in
 * production, which is why the app refuses to boot instead of warning.
 */
describe('assertProductionSafe', () => {
  it('accepts a safe production config', () => {
    expect(() => assertProductionSafe(env())).not.toThrow();
  });

  it('does nothing outside production, so local dev is unaffected', () => {
    expect(() =>
      assertProductionSafe(env({ NODE_ENV: 'development', CORS_ORIGINS: undefined, OTP_DEV_LOG: 'true' })),
    ).not.toThrow();
    expect(() =>
      assertProductionSafe(env({ NODE_ENV: 'test', JWT_ACCESS_SECRET: 'test-access-secret-0123456789' })),
    ).not.toThrow();
  });

  it('refuses to start without CORS_ORIGINS — no browser could use the API anyway', () => {
    expect(() => assertProductionSafe(env({ CORS_ORIGINS: undefined }))).toThrow(/CORS_ORIGINS/);
    expect(() => assertProductionSafe(env({ CORS_ORIGINS: '   ' }))).toThrow(/CORS_ORIGINS/);
  });

  it('refuses to start with the dev OTP flag on — it leaks passcodes into logs', () => {
    expect(() => assertProductionSafe(env({ OTP_DEV_LOG: 'true' }))).toThrow(/OTP_DEV_LOG/);
  });

  it('refuses a secret that is still an example value from this repository', () => {
    expect(() => assertProductionSafe(env({ JWT_ACCESS_SECRET: 'change-me-access-secret' }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => assertProductionSafe(env({ OTP_HASH_SECRET: 'test-otp-hash-secret-0123456789' }))).toThrow(
      /OTP_HASH_SECRET/,
    );
    // Any "change-me…" prefix, not just the exact strings in .env.example.
    expect(() => assertProductionSafe(env({ JWT_REFRESH_SECRET: 'change-me-please' }))).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });

  it('reports EVERY problem at once, so a deploy is not fixed one restart at a time', () => {
    try {
      assertProductionSafe(env({ CORS_ORIGINS: undefined, OTP_DEV_LOG: 'true' }));
      throw new Error('expected it to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('CORS_ORIGINS');
      expect(message).toContain('OTP_DEV_LOG');
    }
  });

  it('is wired into validateEnv, not just exported', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        JWT_ACCESS_SECRET: 'a-real-access-secret-value',
        JWT_REFRESH_SECRET: 'a-real-refresh-secret-value',
        OTP_HASH_SECRET: 'a-real-otp-hash-secret-value',
        NODE_ENV: 'production',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });
});

/**
 * FEAT-013 / ADR-0024. The ADR tells operators that `0` means "no expiry". A schema
 * that rejects `0` turns following the documentation into a failed boot (V2 P1-3), so
 * the accepted values are asserted here rather than left to the decorator.
 */
describe('JWT_REFRESH_TTL_SECONDS', () => {
  const base = { ...env({ NODE_ENV: 'development', CORS_ORIGINS: undefined }) } as Record<string, unknown>;
  delete base.NODE_ENV;

  it('boots with the value unset — the documented default, meaning lifetime', () => {
    expect(() => validateEnv({ ...base })).not.toThrow();
  });

  it('boots with 0, which ADR-0024 documents as lifetime', () => {
    expect(() => validateEnv({ ...base, JWT_REFRESH_TTL_SECONDS: '0' })).not.toThrow();
  });

  it('boots with a positive number, which restores an expiring session', () => {
    expect(() => validateEnv({ ...base, JWT_REFRESH_TTL_SECONDS: '3600' })).not.toThrow();
  });

  it('refuses a negative number rather than silently meaning lifetime', () => {
    expect(() => validateEnv({ ...base, JWT_REFRESH_TTL_SECONDS: '-1' })).toThrow(
      /JWT_REFRESH_TTL_SECONDS/,
    );
  });
});
