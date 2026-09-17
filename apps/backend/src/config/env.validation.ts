import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

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
   * Comma-separated CORS allowlist (ADR-0014). Optional: unset outside
   * production means "any localhost port"; unset in production means no
   * cross-origin browser access.
   */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;
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
  return validated;
}
