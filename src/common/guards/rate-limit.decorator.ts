import { SetMetadata } from '@nestjs/common';
import type { Env } from '../../config/env.schema.js';

export const RATE_LIMIT_KEY = 'http:rate-limit';

/** Config keys that hold a request limit. */
export type RateLimitConfigKey = Extract<
  keyof Env,
  'AUTH_RATE_LIMIT_PER_MINUTE'
>;

export interface RateLimitOptions {
  /** Window length in milliseconds */
  windowMs: number;
  /** The limit is read from configuration, so deployments can tune it */
  limitFrom: RateLimitConfigKey;
}

/** Limits how often one IP address may call a route. */
export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Brute-force protection for credential endpoints. */
export const AuthRateLimit = (): MethodDecorator =>
  RateLimit({ windowMs: 60_000, limitFrom: 'AUTH_RATE_LIMIT_PER_MINUTE' });
