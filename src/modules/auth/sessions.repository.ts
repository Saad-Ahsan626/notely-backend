import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { SessionModel } from '../../generated/prisma/models.js';

export interface CreateSessionData {
  userId: string;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSessionData): Promise<SessionModel> {
    return this.prisma.session.create({ data });
  }

  findById(id: string): Promise<SessionModel | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  /** True when the session exists, is not revoked and has not expired. */
  async isActive(id: string): Promise<boolean> {
    const count = await this.prisma.session.count({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    return count > 0;
  }

  /**
   * Compare-and-swap rotation: the hash is replaced only if it still matches the token
   * that was presented. Two concurrent refreshes cannot both succeed, so a replayed
   * token is always detected. The old hash is kept to recognise a later replay.
   *
   * @returns true when this request performed the rotation
   */
  async rotate(
    id: string,
    currentHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.session.updateMany({
      where: {
        id,
        refreshTokenHash: currentHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: currentHash,
        expiresAt,
      },
    });

    return count === 1;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Used by "log out from all devices" and by stolen-token detection. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
