import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Thin injectable wrapper around a single ioredis connection. Used for OTP
 * state, rate-limit counters, and refresh-token tracking (ADR-0007). Redis is
 * NEVER the source of truth for domain counts/state — auth state only here.
 */
@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly log = new Logger(RedisService.name);

  constructor() {
    super({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.quit();
    } catch (err) {
      this.log.warn(`Redis quit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
