import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

/** Minimum length for any signing/hashing secret. */
const SECRET_MIN_LENGTH = 16;

/**
 * Schema for the required runtime environment. Validated once at boot via
 * `ConfigModule.forRoot({ validate })` so the app FAILS FAST with a clear error
 * if a secret is missing/too short — it can never boot on a default secret.
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;

  @IsString()
  @MinLength(SECRET_MIN_LENGTH, {
    message: `JWT_ACCESS_SECRET must be at least ${SECRET_MIN_LENGTH} characters.`,
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(SECRET_MIN_LENGTH, {
    message: `JWT_REFRESH_SECRET must be at least ${SECRET_MIN_LENGTH} characters.`,
  })
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @MinLength(SECRET_MIN_LENGTH, {
    message: `OTP_HASH_SECRET must be at least ${SECRET_MIN_LENGTH} characters.`,
  })
  OTP_HASH_SECRET!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL_SECONDS?: number;

  /**
   * Refresh-token lifetime in seconds. Unset **or `0`** means sessions never expire —
   * ADR-0024 decision (1). A positive value restores an expiring refresh token.
   *
   * `@Min(0)`, not `@Min(1)`: `AuthService` reads `0` as lifetime, and the ADR tells
   * operators to write it. With `@Min(1)` following the documentation took the API
   * down at boot (V2 P1-3).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  JWT_REFRESH_TTL_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  OTP_DEV_LOG?: string;

  /**
   * Comma-separated CORS allowlist (ADR-0014). Optional: unset in a dev/test
   * environment means "any localhost port"; unset anywhere else (production
   * included) means no cross-origin browser access at all.
   */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /**
   * Optional, but when present it must be one of these: NODE_ENV decides the
   * CORS localhost fallback (ADR-0014), so a typo like 'prod' must abort the
   * boot loudly rather than quietly change a security control.
   */
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  /**
   * Web push identity (FEAT-020, ADR-0032). All three or none: without them push is
   * switched off (subscribing answers PUSH_DISABLED). Required in production.
   * Generate with `npx web-push generate-vapid-keys`; SUBJECT is a `mailto:` or https URL.
   */
  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  @IsOptional()
  @Matches(/^(mailto:|https:\/\/)/, { message: 'VAPID_SUBJECT must be a mailto: or https:// URL.' })
  VAPID_SUBJECT?: string;

  /** Push worker tuning (ADR-0032): parallel sends per process, and a cross-worker ceiling. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  PUSH_CONCURRENCY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PUSH_RATE_PER_SECOND?: number;
}

/**
 * ConfigModule `validate` hook. Coerces + validates the raw env and throws on
 * any violation so startup aborts before serving a single request.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? { unknown: `${e.property} is invalid` }).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  assertProductionSafe(validated);
  return validated;
}

/** Secrets shipped in `.env.example`. Never acceptable in production. */
const EXAMPLE_SECRETS = [
  'change-me',
  'change-me-access-secret',
  'change-me-refresh-secret',
  'change-me-otp-hash-secret',
  'test-access-secret-0123456789',
  'test-refresh-secret-0123456789',
  'test-otp-hash-secret-0123456789',
];

/**
 * Extra rules that apply ONLY in production (CHORE-007, ADR-0020).
 *
 * Every failure mode here is silent by nature, which is why the app refuses to boot
 * rather than warning:
 *  - missing `CORS_ORIGINS` looks like a frontend bug, not a config error (ADR-0014
 *    already fails closed, so the API would simply reject every browser call);
 *  - `OTP_DEV_LOG=true` looks like nothing at all while leaking one-time passcodes
 *    into the logs;
 *  - an example secret looks completely normal until someone forges a token with a
 *    value that is published in this repository.
 */
export function assertProductionSafe(env: EnvironmentVariables): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }
  const problems: string[] = [];

  if (!env.CORS_ORIGINS || env.CORS_ORIGINS.trim().length === 0) {
    problems.push(
      'CORS_ORIGINS must list the exact browser origins allowed to call this API (unset means no browser can use it)',
    );
  }
  // FEAT-020 (ADR-0032): residents opt in to push expecting it to work; a missing key is
  // silent (every subscribe answers PUSH_DISABLED), so production refuses to boot without it.
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    problems.push('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must all be set — web push needs them');
  }
  if (env.OTP_DEV_LOG === 'true') {
    problems.push('OTP_DEV_LOG must not be enabled in production — it exposes one-time passcodes');
  }
  for (const [name, value] of [
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['OTP_HASH_SECRET', env.OTP_HASH_SECRET],
  ] as const) {
    if (EXAMPLE_SECRETS.some((example) => value === example || value.startsWith('change-me'))) {
      problems.push(`${name} is still an example value from the repository — generate a real secret`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}
