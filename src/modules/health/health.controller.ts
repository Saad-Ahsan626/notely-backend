import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { SkipEnvelope } from '../../common/decorators/skip-envelope.decorator.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './interfaces/health-status.interface.js';
import type { ReadinessStatus } from './interfaces/readiness-status.interface.js';

/** Infrastructure endpoints: plain JSON bodies for load balancers and uptime monitors. */
@Public()
@SkipEnvelope()
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
      // 503 tells load balancers to stop routing traffic here without restarting the app.
      // Rendered in the standard error format by the global exception filter.
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return readiness;
  }
}
