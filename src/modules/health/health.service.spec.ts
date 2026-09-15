import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;
  const prismaMock = { isHealthy: vi.fn<() => Promise<boolean>>() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        // No real database in unit tests: PrismaService is replaced by a mock
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    prismaMock.isHealthy.mockReset();
  });

  describe('check', () => {
    it('reports ok status with uptime in whole seconds and a UTC timestamp', () => {
      // Arrange
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-15T10:30:00.000Z'));
      vi.spyOn(process, 'uptime').mockReturnValue(42.9);

      // Act
      const result = service.check();

      // Assert
      expect(result).toEqual({
        status: 'ok',
        uptime: 42,
        timestamp: '2026-09-15T10:30:00.000Z',
      });
    });

    it('does not touch the database', () => {
      service.check();

      expect(prismaMock.isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('checkReadiness', () => {
    it('reports ok when the database is healthy', async () => {
      prismaMock.isHealthy.mockResolvedValue(true);

      await expect(service.checkReadiness()).resolves.toEqual({
        status: 'ok',
        database: 'up',
      });
    });

    it('reports error when the database is unreachable', async () => {
      prismaMock.isHealthy.mockResolvedValue(false);

      await expect(service.checkReadiness()).resolves.toEqual({
        status: 'error',
        database: 'down',
      });
    });
  });
});
