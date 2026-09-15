import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator.js';
import { PaginatedResult } from '../dto/paginated-result.js';

/**
 * Wraps successful responses in the API's envelope:
 * a resource becomes `{ data }`, a PaginatedResult becomes `{ data, meta }`.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip || context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(map(toEnvelope));
  }
}

export function toEnvelope(value: unknown): unknown {
  // No body (e.g. 204 No Content) and file streams are sent untouched
  if (value === undefined || value instanceof StreamableFile) {
    return value;
  }
  if (value instanceof PaginatedResult) {
    return { data: value.data, meta: value.meta };
  }
  return { data: value };
}
