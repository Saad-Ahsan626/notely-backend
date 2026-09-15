import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'response:skip-envelope';

/**
 * Returns the handler's value as-is instead of wrapping it in `{ data }`.
 * Used for infrastructure endpoints such as health checks.
 */
export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE_KEY, true);
