import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

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
   * Rotates the refresh token. Presenting an already-rotated token means two parties hold
   * it, so every session of that user is revoked (see ADR 0011).
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const parts = this.tokenService.parseRefreshToken(refreshToken);
    if (!parts) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.sessionsRepository.findById(parts.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      !this.tokenService.matchesStoredHash(
        parts.secret,
        session.refreshTokenHash,
      )
    ) {
      await this.handleTokenReuse(session.userId, session.id);
    }

    const next = this.tokenService.generateRefreshSecret();
    const rotated = await this.sessionsRepository.rotate(
      session.id,
      session.refreshTokenHash,
      next.hash,
      new Date(Date.now() + this.tokenService.refreshTokenTtlMs),
    );

    // Another request rotated first: this token was already spent
    if (!rotated) {
      await this.handleTokenReuse(session.userId, session.id);
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

    throw new UnauthorizedException('Invalid refresh token');
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
