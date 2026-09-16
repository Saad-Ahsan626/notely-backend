import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { isUniqueConstraintError } from '../../database/prisma-errors.js';
import type { UserModel } from '../../generated/prisma/models.js';
import { toUserResponse } from '../users/dto/user-response.dto.js';
import { UsersService } from '../users/users.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type {
  AuthResult,
  AuthTokens,
  SessionContext,
} from './interfaces/auth-response.interface.js';
import { PasswordService } from './password.service.js';
import { SessionsRepository } from './sessions.repository.js';
import { TokenService } from './token.service.js';

/** The same message for every failed credential check, so accounts cannot be enumerated. */
const INVALID_CREDENTIALS = 'Invalid credentials';
const EMAIL_TAKEN = 'Email is already registered';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async register(
    dto: RegisterDto,
    context: SessionContext,
  ): Promise<AuthResult> {
    // Fast path: skip the expensive hash when the email is obviously taken
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException(EMAIL_TAKEN);
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    let user: UserModel;
    try {
      user = await this.usersService.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
    } catch (error) {
      // Two registrations can pass the check above at the same moment; the unique index
      // lets only one insert succeed, and the other must get the same clear message
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(EMAIL_TAKEN, { cause: error });
      }
      throw error;
    }

    return this.startSession(user, context);
  }

  async login(dto: LoginDto, context: SessionContext): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      // Spend the same time as a real verification so timing does not reveal the account
      await this.passwordService.verifyDummy(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.upgradePasswordHashIfNeeded(user, dto.password);

    return this.startSession(user, context);
  }

  /**
   * Rotates the refresh token (see ADR 0011).
   *
   * - The current secret gets a new pair.
   * - The secret this session already rotated away from means the token was copied and
   *   replayed, so every session of the user is revoked.
   * - Anything else is simply invalid. The session ID is visible inside every access token,
   *   so a guessed secret must never be able to log the user out everywhere.
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const parts = this.tokenService.parseRefreshToken(refreshToken);
    if (!parts) {
      throw invalidRefreshToken();
    }

    const session = await this.sessionsRepository.findById(parts.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw invalidRefreshToken();
    }

    const isCurrent = this.tokenService.matchesStoredHash(
      parts.secret,
      session.refreshTokenHash,
    );

    if (!isCurrent) {
      const isPrevious =
        session.previousRefreshTokenHash !== null &&
        this.tokenService.matchesStoredHash(
          parts.secret,
          session.previousRefreshTokenHash,
        );

      if (isPrevious) {
        return this.handleTokenReuse(session.userId, session.id);
      }
      throw invalidRefreshToken();
    }

    const next = this.tokenService.generateRefreshSecret();
    const rotated = await this.sessionsRepository.rotate(
      session.id,
      session.refreshTokenHash,
      next.hash,
      new Date(Date.now() + this.tokenService.refreshTokenTtlMs),
    );

    // A concurrent request rotated this same secret first: it was used twice
    if (!rotated) {
      return this.handleTokenReuse(session.userId, session.id);
    }

    const accessToken = await this.tokenService.signAccessToken({
      userId: session.userId,
      sessionId: session.id,
    });

    return this.buildTokens(
      accessToken,
      this.tokenService.composeRefreshToken(session.id, next.secret),
    );
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionsRepository.revoke(sessionId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionsRepository.revokeAllForUser(userId);
  }

  private async handleTokenReuse(
    userId: string,
    sessionId: string,
  ): Promise<never> {
    this.logger.warn(
      `Refresh token reuse detected for session ${sessionId}; revoking all sessions of user ${userId}`,
    );
    await this.sessionsRepository.revokeAllForUser(userId);

    throw invalidRefreshToken();
  }

  private async upgradePasswordHashIfNeeded(
    user: UserModel,
    password: string,
  ): Promise<void> {
    if (!this.passwordService.needsRehash(user.passwordHash)) {
      return;
    }

    const passwordHash = await this.passwordService.hash(password);
    await this.usersService.updatePasswordHash(user.id, passwordHash);
  }

  private async startSession(
    user: UserModel,
    context: SessionContext,
  ): Promise<AuthResult> {
    // The secret is independent of the session ID, so the session is stored once,
    // already carrying the final hash
    const refresh = this.tokenService.generateRefreshSecret();
    const session = await this.sessionsRepository.create({
      userId: user.id,
      refreshTokenHash: refresh.hash,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      expiresAt: new Date(Date.now() + this.tokenService.refreshTokenTtlMs),
    });

    const accessToken = await this.tokenService.signAccessToken({
      userId: user.id,
      sessionId: session.id,
    });

    return {
      user: toUserResponse(user),
      tokens: this.buildTokens(
        accessToken,
        this.tokenService.composeRefreshToken(session.id, refresh.secret),
      ),
    };
  }

  private buildTokens(accessToken: string, refreshToken: string): AuthTokens {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.tokenService.accessTokenTtlSeconds,
    };
  }
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException('Invalid refresh token');
}
