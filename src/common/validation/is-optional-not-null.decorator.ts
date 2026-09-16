import { ValidateIf } from 'class-validator';

/**
 * Like @IsOptional(), but only skips validation when the property is absent.
 *
 * @IsOptional() also skips `null`, so `{ "content": null }` would pass validation and then
 * fail on a NOT NULL database column with a 500. With this decorator, `null` is validated
 * like any other value and rejected by the property's own rules (400).
 */
export const IsOptionalNotNull = (): PropertyDecorator =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
