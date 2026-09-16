import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { SessionsRepository } from '../sessions.repository.js';
import type { TokenService } from '../token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const tokenService = {
    verifyAccessToken: vi.fn<TokenService['verifyAccessToken']>(),
  };
  const sessionsRepository = {
    isActive: vi.fn<SessionsRepository['isActive']>(),
  };
  const guard = new JwtAuthGuard(
    reflector,
    tokenService as unknown as TokenService,
    sessionsRepository as unknown as SessionsRepository,
  );

  function contextFor(
    request: Partial<Request>,
    isPublic = false,
  ): ExecutionContext {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tokenService.verifyAccessToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    sessionsRepository.isActive.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lets public routes through without a token', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} }, true)),
    ).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('attaches the user when the token and session are valid', async () => {
    const request = { headers: { authorization: 'Bearer valid.token' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      userId: 'user-1',
      sessionId: 'session-1',
    });
  });

  it('accepts the scheme case-insensitively', async () => {
    const request = { headers: { authorization: 'bearer valid.token' } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });

  it.each([
    ['no Authorization header', {}],
    ['empty header', { authorization: '' }],
    ['wrong scheme', { authorization: 'Basic dXNlcjpwYXNz' }],
    ['scheme without a token', { authorization: 'Bearer' }],
  ])('rejects a request with %s', async (_case, headers) => {
    await expect(
      guard.canActivate(contextFor({ headers })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an invalid token without revealing why', async () => {
    tokenService.verifyAccessToken.mockRejectedValue(
      new Error('jwt expired at 2026-01-01'),
    );

    const promise = guard.canActivate(
      contextFor({ headers: { authorization: 'Bearer expired.token' } }),
    );

    await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(promise).rejects.not.toThrow(/expired at/);
  });

  it('rejects a valid token whose session was revoked (immediate logout)', async () => {
    sessionsRepository.isActive.mockResolvedValue(false);

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: 'Bearer valid.token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
