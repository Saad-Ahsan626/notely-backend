import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { type UserResponse, toUserResponse } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** The authenticated user's own profile. */
  @Get('me')
  async getCurrentUser(
    @CurrentUser() { userId }: AuthenticatedUser,
  ): Promise<UserResponse> {
    const user = await this.usersService.findByIdOrFail(userId);

    return toUserResponse(user);
  }
}
