import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';

/**
 * Injects the authenticated user into a handler, so controllers never touch the
 * raw request object. Present on every route that is not marked @Public().
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    return request.user;
  },
);
