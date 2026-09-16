import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env.schema.js';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator.js';

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window rate limiting per IP and route, for brute-force protection on auth endpoints.
 *
 * Counters live in this process, so each instance counts separately. A shared store (Redis)
 * is needed once the API runs on more than one instance. Client IPs are only trustworthy
 * when TRUST_PROXY matches the deployment.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options || context.getType() !== 'http') {
      return true;
    }

    const limit = this.config.get(options.limitFrom, { infer: true });
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = `${request.method}:${request.route?.path ?? request.path}:${request.ip ?? 'unknown'}`;
    const now = Date.now();

    this.pruneExpired(now);

    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    window.count += 1;
    if (window.count > limit) {
      const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
      response.setHeader('Retry-After', retryAfterSeconds);
      throw new HttpException(
        'Too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /** Keeps the map from growing without bound; windows are short-lived. */
  private pruneExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}
