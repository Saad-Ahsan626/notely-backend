import { ValidationPipe } from '@nestjs/common';
import {
  flattenValidationErrors,
  ValidationException,
} from './validation.exception.js';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Strip properties that have no validation decorator...
    whitelist: true,
    // ...and reject the request if any were sent (prevents mass assignment, e.g. "userId")
    forbidNonWhitelisted: true,
    // Turn plain JSON into DTO class instances
    transform: true,
    // Conversions must be explicit (@Type(() => Number)); implicit conversion turns "false" into true
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: (errors) =>
      new ValidationException(flattenValidationErrors(errors)),
  });
}
