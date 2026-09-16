import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Env } from '../../config/env.schema.js';
import type { RateLimitOptions } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

const AUTH_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  limitFrom: 'AUTH_RATE_LIMIT_PER_MINUTE',
};

/** Returns what a call threw, so assertions stay outside try/catch. */
function captureError(call: () => unknown): unknown {
  try {
    call();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('RateLimitGuard', () => {
  const reflector = new Reflector();
  const config = { get: () => 3 } as unknown as ConfigService<Env, true>;
  const setHeader = vi.fn<(name: string, value: unknown) => void>();
  let guard: RateLimitGuard;

  function contextFor(
    ip: string,
    options: RateLimitOptions | undefined = AUTH_LIMIT,
  ): ExecutionContext {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options);

    return {
      getType: () => 'http',
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/auth/login', ip }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new RateLimitGuard(reflector, config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('allows routes without a rate limit', () => {
    expect(guard.canActivate(contextFor('1.1.1.1', undefined))).toBe(true);
  });

  it('allows requests up to the configured limit', () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(guard.canActivate(contextFor('1.1.1.1'))).toBe(true);
    }
  });

  it('blocks further requests with 429 and a Retry-After header', () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      guard.canActivate(contextFor('1.1.1.1'));
    }

    const error = captureError(() => guard.canActivate(contextFor('1.1.1.1')));

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('counts each client IP separately', () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      guard.canActivate(contextFor('1.1.1.1'));
    }

    expect(guard.canActivate(contextFor('2.2.2.2'))).toBe(true);
  });

  it('starts a fresh window once the old one has passed', () => {
    vi.useFakeTimers();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      guard.canActivate(contextFor('1.1.1.1'));
    }
    expect(() => guard.canActivate(contextFor('1.1.1.1'))).toThrow(
      HttpException,
    );

    vi.advanceTimersByTime(60_001);

    expect(guard.canActivate(contextFor('1.1.1.1'))).toBe(true);
  });
});
