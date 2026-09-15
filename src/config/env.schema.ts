import { z } from 'zod';

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
});

export type Env = z.infer<typeof envSchema>;

/**
 * Used by ConfigModule at startup. Throws with every problem listed at once,
 * so the app refuses to boot with invalid configuration (fail fast).
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
