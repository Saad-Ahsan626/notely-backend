import { z } from 'zod';

/**
 * The placeholder in .env.example. Accepted in development and tests so a fresh clone runs,
 * but rejected in production so a copied placeholder can never secure real tokens.
 */
export const EXAMPLE_JWT_SECRET =
  'dev-only-example-secret-change-me-before-deploying';

/**
 * Single source of truth for environment variables.
 * The TypeScript type is inferred from the schema, so validation and types can never drift apart.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({
    protocol: /^mysql$/,
    error: 'DATABASE_URL must be a valid mysql:// connection URL',
  }),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  /** Comma-separated browser origins allowed by CORS. Empty means no browser origins. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .url({
            protocol: /^https?$/,
            error:
              'CORS_ORIGINS must be a comma-separated list of http(s) URLs',
          })
          .refine(
            (value) => {
              const url = new URL(value);
              return url.pathname === '/' && !url.search && !url.hash;
            },
            {
              error:
                'CORS_ORIGINS entries must be origins only (scheme, host and port, no path)',
            },
          )
          // Browsers send the Origin header without a trailing slash
          .transform((value) => new URL(value).origin),
      ),
    ),
  /**
   * Number of reverse proxies in front of the app (0 = none). Express then reads the client IP
   * that many hops from the right of X-Forwarded-For. `true` is refused on purpose: it trusts
   * every hop, and clients control the left-most entries, so they could choose their own IP.
   */
  TRUST_PROXY: z
    .preprocess(
      (value) => (value === 'false' ? '0' : value),
      z.coerce
        .number({
          error:
            'TRUST_PROXY must be the number of trusted proxy hops (0 for none)',
        })
        .int()
        .min(0)
        .max(10),
    )
    .default(0),
  /** Signing key for access tokens. Generate with: npm run secret:generate */
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Login and registration attempts allowed per IP address per minute */
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(5),
});

/** Cross-field rules that need the whole environment. */
export const validatedEnvSchema = envSchema.refine(
  (env) =>
    env.NODE_ENV !== 'production' ||
    env.JWT_ACCESS_SECRET !== EXAMPLE_JWT_SECRET,
  {
    path: ['JWT_ACCESS_SECRET'],
    error:
      'JWT_ACCESS_SECRET is still the .env.example placeholder; generate a real secret before deploying',
  },
);

export type Env = z.infer<typeof envSchema>;

/**
 * Used by ConfigModule at startup. Throws with every problem listed at once,
 * so the app refuses to boot with invalid configuration (fail fast).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = validatedEnvSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
