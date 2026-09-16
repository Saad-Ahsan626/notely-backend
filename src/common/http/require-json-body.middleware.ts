import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * The API accepts JSON only. A request that carries a body in any other format
 * (form data, plain text, no Content-Type) is answered with 415 before it is parsed.
 */
export function requireJsonBody(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const contentLength = request.headers['content-length'];
  const hasBody =
    request.headers['transfer-encoding'] !== undefined ||
    (contentLength !== undefined && contentLength !== '0');

  if (hasBody && request.is('application/json') === false) {
    next(
      new UnsupportedMediaTypeException(
        'Content-Type must be application/json',
      ),
    );
    return;
  }

  next();
}
