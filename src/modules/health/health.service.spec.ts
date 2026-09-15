import { Test, type TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get(HealthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
});
