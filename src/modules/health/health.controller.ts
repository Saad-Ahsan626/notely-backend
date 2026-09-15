import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './interfaces/health-status.interface.js';
import type { ReadinessStatus } from './interfaces/readiness-status.interface.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }

  @Get('ready')
  async checkReadiness(): Promise<ReadinessStatus> {
    const readiness = await this.healthService.checkReadiness();

    if (readiness.status !== 'ok') {
      // 503 tells load balancers to stop routing traffic here without restarting the app
      throw new ServiceUnavailableException(readiness);
    }

    return readiness;
  }
}
