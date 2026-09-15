import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import type { HealthStatus } from './interfaces/health-status.interface.js';
import type { ReadinessStatus } from './interfaces/readiness-status.interface.js';

describe('HealthController', () => {
  let controller: HealthController;
  const healthStatus: HealthStatus = {
    status: 'ok',
    uptime: 10,
    timestamp: '2026-09-15T10:30:00.000Z',
  };
  const healthServiceMock = {
    check: vi.fn<() => HealthStatus>(() => healthStatus),
    checkReadiness: vi.fn<() => Promise<ReadinessStatus>>(),
  };

  beforeEach(async () => {
    // The real HealthService is replaced by a mock: the controller is tested in isolation
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthServiceMock }],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates the liveness check to HealthService', () => {
    const result = controller.check();

    expect(healthServiceMock.check).toHaveBeenCalledOnce();
    expect(result).toBe(healthStatus);
  });

  it('returns the readiness status when dependencies are up', async () => {
    const ready: ReadinessStatus = { status: 'ok', database: 'up' };
    healthServiceMock.checkReadiness.mockResolvedValue(ready);

    await expect(controller.checkReadiness()).resolves.toBe(ready);
  });

  it('throws 503 Service Unavailable when the database is down', async () => {
    healthServiceMock.checkReadiness.mockResolvedValue({
      status: 'error',
      database: 'down',
    });

    await expect(controller.checkReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
