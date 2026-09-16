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

/**
 * Rules that check what kind of value arrived. When one fails, rules about the value's shape
 * (length, range) are noise: "must be shorter than 100 characters" is misleading for an array.
 */
const TYPE_CONSTRAINTS = new Set([
  'isString',
  'isBoolean',
  'isInt',
  'isNumber',
  'isEmail',
  'isUuid',
  'isIn',
  'isEnum',
  'isArray',
  'isObject',
  'isDate',
  'isDateString',
]);

/**
 * Flattens class-validator's nested error tree into one entry per failed rule. If a type
 * rule failed for a field, only the type errors are reported for that field.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const failed = Object.entries(error.constraints ?? {});
    const typeFailures = failed.filter(([rule]) => TYPE_CONSTRAINTS.has(rule));
    const reported = typeFailures.length > 0 ? typeFailures : failed;
    const own = reported.map(([, message]) => ({ field, message }));
    const nested = flattenValidationErrors(error.children ?? [], field);

    return [...own, ...nested];
  });
}
