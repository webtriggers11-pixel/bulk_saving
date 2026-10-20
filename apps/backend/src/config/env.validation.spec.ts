import { assertProductionSafe, assertWhatsAppConfigComplete, validateEnv, type EnvironmentVariables } from './env.validation';

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
    VAPID_PUBLIC_KEY: 'B'.repeat(87),
    VAPID_PRIVATE_KEY: 'p'.repeat(43),
    VAPID_SUBJECT: 'mailto:ops@example.com',
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

  it.each(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const)(
    'refuses production without %s — push would silently refuse every subscriber (FEAT-020)',
    (key) => {
      expect(() => assertProductionSafe(env({ [key]: undefined }))).toThrow(/VAPID/);
    },
  );

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

describe('VAPID key format (FEAT-020 V2 P3)', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    JWT_ACCESS_SECRET: 'a-real-access-secret-value',
    JWT_REFRESH_SECRET: 'a-real-refresh-secret-value',
    OTP_HASH_SECRET: 'a-real-otp-hash-secret-value',
  };
  it('refuses the example placeholder with a clear message', () => {
    expect(() => validateEnv({ ...base, VAPID_PUBLIC_KEY: '__GENERATE__' })).toThrow(/87-character/);
    expect(() => validateEnv({ ...base, VAPID_PRIVATE_KEY: '__GENERATE__' })).toThrow(/43-character/);
  });
  it('accepts real-shaped keys', () => {
    expect(() =>
      validateEnv({ ...base, VAPID_PUBLIC_KEY: 'B'.repeat(87), VAPID_PRIVATE_KEY: 'p'.repeat(43), VAPID_SUBJECT: 'mailto:a@b.co' }),
    ).not.toThrow();
  });
});

/** FEAT-027 (ADR-0038): the five Cloud API variables come together or not at all — in every environment. */
describe('WhatsApp sign-in configuration', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    JWT_ACCESS_SECRET: 'a-real-access-secret-value',
    JWT_REFRESH_SECRET: 'a-real-refresh-secret-value',
    OTP_HASH_SECRET: 'a-real-otp-hash-secret-value',
  };
  const full = {
    WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
    WHATSAPP_ACCESS_TOKEN: 'EAAG-a-long-enough-test-token',
    WHATSAPP_APP_SECRET: 'an-app-secret-0123456789',
    WHATSAPP_VERIFY_TOKEN: 'a-verify-token-0123456789',
    WHATSAPP_BUSINESS_NUMBER: '919876543210',
  };

  it('boots with none (off / stub) and with all five (cloud)', () => {
    expect(() => validateEnv({ ...base })).not.toThrow();
    expect(() => validateEnv({ ...base, ...full })).not.toThrow();
    expect(() => validateEnv({ ...base, ...full, WHATSAPP_GRAPH_VERSION: 'v27.0' })).not.toThrow();
  });

  it('refuses a partial set, naming what is missing', () => {
    const { WHATSAPP_VERIFY_TOKEN: _dropped, ...partial } = full;
    void _dropped;
    expect(() => validateEnv({ ...base, ...partial })).toThrow(/missing WHATSAPP_VERIFY_TOKEN/);
    expect(() => assertWhatsAppConfigComplete({ ...full, WHATSAPP_APP_SECRET: '' })).toThrow(/WHATSAPP_APP_SECRET/);
  });

  it('refuses malformed values with a clear message', () => {
    expect(() => validateEnv({ ...base, ...full, WHATSAPP_BUSINESS_NUMBER: '+919876543210' })).toThrow(/WHATSAPP_BUSINESS_NUMBER/);
    expect(() => validateEnv({ ...base, ...full, WHATSAPP_PHONE_NUMBER_ID: 'abc' })).toThrow(/WHATSAPP_PHONE_NUMBER_ID/);
    expect(() => validateEnv({ ...base, ...full, WHATSAPP_GRAPH_VERSION: '26' })).toThrow(/WHATSAPP_GRAPH_VERSION/);
    expect(() => validateEnv({ ...base, ...full, WHATSAPP_APP_SECRET: 'short' })).toThrow(/WHATSAPP_APP_SECRET/);
  });
});
