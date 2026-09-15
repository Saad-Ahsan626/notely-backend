import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './interfaces/health-status.interface.js';

describe('HealthController', () => {
  let controller: HealthController;
  const healthStatus: HealthStatus = {
    status: 'ok',
    uptime: 10,
    timestamp: '2026-09-15T10:30:00.000Z',
  };
  const healthServiceMock = {
    check: vi.fn<() => HealthStatus>(() => healthStatus),
  };

  beforeEach(async () => {
    // The real HealthService is replaced by a mock: the controller is tested in isolation
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthServiceMock }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('delegates to HealthService and returns its result', () => {
    const result = controller.check();

    expect(healthServiceMock.check).toHaveBeenCalledOnce();
    expect(result).toBe(healthStatus);
  });
});
