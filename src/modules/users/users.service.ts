import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserModel } from '../../generated/prisma/models.js';
import { type CreateUserData, UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(data: CreateUserData): Promise<UserModel> {
    return this.usersRepository.create(data);
  }

  findByEmail(email: string): Promise<UserModel | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByIdOrFail(id: string): Promise<UserModel> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  updatePasswordHash(id: string, passwordHash: string): Promise<UserModel> {
    return this.usersRepository.updatePasswordHash(id, passwordHash);
  }
}
