import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ValidationErrorDetail {
  /** Dot path to the invalid property, e.g. "title" or "tags.0.name" */
  field: string;
  message: string;
}

/** Thrown by the global ValidationPipe; rendered as `details` by the exception filter. */
export class ValidationException extends BadRequestException {
  constructor(readonly details: ValidationErrorDetail[]) {
    super('Validation failed');
  }
}

/** Flattens class-validator's nested error tree into one entry per failed rule. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    const nested = flattenValidationErrors(error.children ?? [], field);

    return [...own, ...nested];
  });
}
