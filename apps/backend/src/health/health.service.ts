import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@bulk/shared';

@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    };
  }
}
