import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env.schema.js';
import type {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/authenticated-user.interface.js';

export const JWT_ISSUER = 'notely-api';
export const JWT_AUDIENCE = 'notely-app';

export interface RefreshTokenParts {
  sessionId: string;
  secret: string;
}

export interface RefreshSecret {
  /** The credential half of the token; never stored */
  secret: string;
  /** SHA-256 of the secret, stored in the sessions table */
  hash: string;
}

/**
 * Access tokens are signed JWTs (verified without a database read).
 * Refresh tokens are opaque random secrets, checked against a hash in the sessions table,
 * so they can be revoked and rotated (see ADR 0011).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTokenTtlSeconds(): number {
    return this.config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }) * 60;
  }

  get refreshTokenTtlMs(): number {
    return (
      this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) *
      24 *
      60 *
      60 *
      1000
    );
  }

  signAccessToken({ userId, sessionId }: AuthenticatedUser): Promise<string> {
    return this.jwtService.signAsync(
      { sid: sessionId },
      {
        subject: userId,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );
  }

  /** Throws when the token is tampered with, expired, or not issued by us. */
  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      // Pinning the algorithm blocks "alg: none" and algorithm-confusion attacks
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return { userId: payload.sub, sessionId: payload.sid };
  }

  /** 256 bits of randomness: guessing is infeasible, so a fast hash is enough. */
  generateRefreshSecret(): RefreshSecret {
    const secret = randomBytes(32).toString('base64url');

    return { secret, hash: this.hashRefreshSecret(secret) };
  }

  /**
   * The token sent to the client. The session ID is an address (which row to load),
   * not a credential: only the secret half authenticates.
   */
  composeRefreshToken(sessionId: string, secret: string): string {
    return `${sessionId}.${secret}`;
  }

  parseRefreshToken(token: string): RefreshTokenParts | undefined {
    const separator = token.indexOf('.');
    if (separator <= 0 || separator === token.length - 1) {
      return undefined;
    }

    return {
      sessionId: token.slice(0, separator),
      secret: token.slice(separator + 1),
    };
  }

  hashRefreshSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /** Constant-time comparison: `===` leaks how many characters matched. */
  matchesStoredHash(secret: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hashRefreshSecret(secret), 'hex');
    const stored = Buffer.from(storedHash, 'hex');

    return (
      candidate.length === stored.length && timingSafeEqual(candidate, stored)
    );
  }
}
