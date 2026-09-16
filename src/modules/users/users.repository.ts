import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { UserModel } from '../../generated/prisma/models.js';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

/** All user database access lives here (see ADR 0005). */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserData): Promise<UserModel> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updatePasswordHash(id: string, passwordHash: string): Promise<UserModel> {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
