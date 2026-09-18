import { plainToInstance, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

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
