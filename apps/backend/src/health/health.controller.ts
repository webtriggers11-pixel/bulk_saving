import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@bulk/shared';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // Returns a bare HealthStatus; the global ResponseInterceptor wraps it in
  // the standard success envelope: { success: true, data: HealthStatus }.
  @Get()
  check(): HealthStatus {
    return this.health.getStatus();
  }
}
