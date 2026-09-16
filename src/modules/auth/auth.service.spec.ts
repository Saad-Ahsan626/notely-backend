import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { SessionModel, UserModel } from '../../generated/prisma/models.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { SessionsRepository } from './sessions.repository.js';
import type { TokenService } from './token.service.js';

const NOW = new Date('2026-09-16T10:00:00.000Z');

function buildUser(overrides: Partial<UserModel> = {}): UserModel {
  return {
    id: 'user-1',
    email: 'alex@example.com',
    name: 'Alex',
    passwordHash: '$argon2id$stored-hash',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<SessionModel> = {}): SessionModel {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'stored-hash',
    previousRefreshTokenHash: 'previous-hash',
    userAgent: null,
    ipAddress: null,
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('AuthService', () => {
  const usersService = {
    findByEmail: vi.fn<UsersService['findByEmail']>(),
    create: vi.fn<UsersService['create']>(),
    updatePasswordHash: vi.fn<UsersService['updatePasswordHash']>(),
  };
  const passwordService = {
    hash: vi.fn<PasswordService['hash']>(),
    verify: vi.fn<PasswordService['verify']>(),
    verifyDummy: vi.fn<PasswordService['verifyDummy']>(),
    needsRehash: vi.fn<PasswordService['needsRehash']>(),
  };
  const tokenService = {
    signAccessToken: vi.fn<TokenService['signAccessToken']>(),
    generateRefreshSecret: vi.fn<TokenService['generateRefreshSecret']>(),
    composeRefreshToken: vi.fn<TokenService['composeRefreshToken']>(),
    parseRefreshToken: vi.fn<TokenService['parseRefreshToken']>(),
    matchesStoredHash: vi.fn<TokenService['matchesStoredHash']>(),
    accessTokenTtlSeconds: 900,
    refreshTokenTtlMs: 604_800_000,
  };
  const sessionsRepository = {
    create: vi.fn<SessionsRepository['create']>(),
    findById: vi.fn<SessionsRepository['findById']>(),
    rotate: vi.fn<SessionsRepository['rotate']>(),
    revoke: vi.fn<SessionsRepository['revoke']>(),
    revokeAllForUser: vi.fn<SessionsRepository['revokeAllForUser']>(),
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    passwordService as unknown as PasswordService,
    tokenService as unknown as TokenService,
    sessionsRepository as unknown as SessionsRepository,
  );

  const credentials = {
    name: 'Alex',
    email: 'alex@example.com',
    password: 'CorrectHorseBattery1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tokenService.signAccessToken.mockResolvedValue('access-token');
    tokenService.generateRefreshSecret.mockReturnValue({
      secret: 'new-secret',
      hash: 'new-hash',
    });
    tokenService.composeRefreshToken.mockImplementation(
      (sessionId, secret) => `${sessionId}.${secret}`,
    );
    sessionsRepository.create.mockResolvedValue(buildSession());
    sessionsRepository.rotate.mockResolvedValue(true);
  });

  describe('register', () => {
    it('creates the user, opens a session and returns tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('$argon2id$new-hash');
      usersService.create.mockResolvedValue(buildUser());

      const result = await service.register(credentials, {
        userAgent: 'Flutter',
        ipAddress: '1.2.3.4',
      });

      expect(passwordService.hash).toHaveBeenCalledWith(credentials.password);
      expect(usersService.create).toHaveBeenCalledWith({
        email: credentials.email,
        name: credentials.name,
        passwordHash: '$argon2id$new-hash',
      });
      // The hash is stored with the session, not the token itself
      expect(sessionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          refreshTokenHash: 'new-hash',
          userAgent: 'Flutter',
          ipAddress: '1.2.3.4',
        }),
      );
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'session-1.new-secret',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('gives the same clear 409 when a simultaneous registration wins the race', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('$argon2id$new-hash');
      usersService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );

      const attempt = service.register(credentials, {});

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow('Email is already registered');
      expect(sessionsRepository.create).not.toHaveBeenCalled();
    });

    it('does not hide unrelated database errors during registration', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue('$argon2id$new-hash');
      usersService.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.register(credentials, {})).rejects.toThrow(
        'connection lost',
      );
    });

    it('rejects an email that is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(service.register(credentials, {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns tokens for correct credentials', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(false);

      const result = await service.login(credentials, {});

      expect(result.tokens.accessToken).toBe('access-token');
      expect(usersService.updatePasswordHash).not.toHaveBeenCalled();
    });

    it('still hashes a password for an unknown email (timing defence)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(credentials, {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(passwordService.verifyDummy).toHaveBeenCalledWith(
        credentials.password,
      );
    });

    it('rejects a wrong password with the same generic message', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(false);

      await expect(service.login(credentials, {})).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('upgrades an outdated password hash after a successful login', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());
      passwordService.verify.mockResolvedValue(true);
      passwordService.needsRehash.mockReturnValue(true);
      passwordService.hash.mockResolvedValue('$argon2id$stronger');

      await service.login(credentials, {});

      expect(usersService.updatePasswordHash).toHaveBeenCalledWith(
        'user-1',
        '$argon2id$stronger',
      );
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      tokenService.parseRefreshToken.mockReturnValue({
        sessionId: 'session-1',
        secret: 'presented-secret',
      });
      sessionsRepository.findById.mockResolvedValue(buildSession());
      // Only the secret named after a hash matches that hash
      tokenService.matchesStoredHash.mockImplementation(
        (secret, hash) =>
          (secret === 'presented-secret' && hash === 'stored-hash') ||
          (secret === 'old-secret' && hash === 'previous-hash'),
      );
    });

    it('rotates the token and returns a new pair', async () => {
      const tokens = await service.refresh('session-1.presented-secret');

      expect(sessionsRepository.rotate).toHaveBeenCalledWith(
        'session-1',
        'stored-hash',
        'new-hash',
        expect.any(Date),
      );
      expect(tokens.refreshToken).toBe('session-1.new-secret');
    });

    it('rejects a malformed token', async () => {
      tokenService.parseRefreshToken.mockReturnValue(undefined);

      await expect(service.refresh('garbage')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(sessionsRepository.findById).not.toHaveBeenCalled();
    });

    it.each([
      ['unknown session', null],
      ['revoked session', buildSession({ revokedAt: NOW })],
      ['expired session', buildSession({ expiresAt: new Date(2000, 0, 1) })],
    ])('rejects a %s without revoking anything', async (_case, session) => {
      sessionsRepository.findById.mockResolvedValue(session);

      await expect(service.refresh('session-1.secret')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(sessionsRepository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('revokes every session when the previous (already rotated) secret is replayed', async () => {
      tokenService.parseRefreshToken.mockReturnValue({
        sessionId: 'session-1',
        secret: 'old-secret',
      });

      await expect(service.refresh('session-1.old-secret')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(sessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
      expect(sessionsRepository.rotate).not.toHaveBeenCalled();
    });

    it('rejects a guessed secret WITHOUT logging the user out (session IDs are public)', async () => {
      tokenService.parseRefreshToken.mockReturnValue({
        sessionId: 'session-1',
        secret: 'made-up-secret',
      });

      await expect(service.refresh('session-1.made-up-secret')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(sessionsRepository.revokeAllForUser).not.toHaveBeenCalled();
      expect(sessionsRepository.rotate).not.toHaveBeenCalled();
    });

    it('rejects a wrong secret on a session that has never rotated', async () => {
      sessionsRepository.findById.mockResolvedValue(
        buildSession({ previousRefreshTokenHash: null }),
      );
      tokenService.parseRefreshToken.mockReturnValue({
        sessionId: 'session-1',
        secret: 'old-secret',
      });

      await expect(service.refresh('session-1.old-secret')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(sessionsRepository.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('revokes every session when another request rotated first (race)', async () => {
      sessionsRepository.rotate.mockResolvedValue(false);

      await expect(service.refresh('session-1.secret')).rejects.toThrow(
        'Invalid refresh token',
      );
      expect(sessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('logout', () => {
    it('revokes the current session', async () => {
      await service.logout('session-1');

      expect(sessionsRepository.revoke).toHaveBeenCalledWith('session-1');
    });

    it('revokes every session of the user', async () => {
      await service.logoutAll('user-1');

      expect(sessionsRepository.revokeAllForUser).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });
});
