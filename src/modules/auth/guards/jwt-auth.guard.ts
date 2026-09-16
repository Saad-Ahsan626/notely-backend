import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { SessionsRepository } from '../sessions.repository.js';
import { TokenService } from '../token.service.js';

/**
 * Registered globally: every route requires a valid access token unless marked @Public().
 * Forgetting a decorator locks an endpoint instead of exposing it.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException();
    }

    let user;
    try {
      user = await this.tokenService.verifyAccessToken(token);
    } catch {
      // Never reveal which check failed (expired, tampered, wrong audience)
      throw new UnauthorizedException();
    }

    // Stateful check: logout and "log out everywhere" take effect immediately
    if (!(await this.sessionsRepository.isActive(user.sessionId))) {
      throw new UnauthorizedException();
    }

    request.user = user;
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];

  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
