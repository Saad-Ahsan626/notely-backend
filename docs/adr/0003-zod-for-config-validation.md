# 0003. Validate environment configuration with Zod

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

The API reads its configuration (port, database URL, and later JWT secrets) from environment
variables, following the Twelve-Factor App. Environment variables are untyped strings and may be
missing or malformed. If they are only checked when first used, a misconfigured deployment starts
successfully and fails later, at an unpredictable moment.

`@nestjs/config` accepts a custom `validate` function. The NestJS documentation uses Joi.

## Decision

Validate all environment variables **once, at startup**, with a Zod schema passed to
`ConfigModule.forRoot({ validate })`.

- The schema (`src/config/env.schema.ts`) is the single source of truth.
- The `Env` TypeScript type is **inferred** from the schema with `z.infer`.
- Values are coerced and defaulted (e.g. `PORT` becomes a number, default `3000`).
- On failure the app refuses to boot and lists every invalid variable.
- Code reads configuration through `ConfigService<Env, true>` with `{ infer: true }`, never through
  `process.env` directly.

### Alternatives considered

- **Joi:** mature and shown in the Nest docs, but its schema and TypeScript types are separate and
  must be kept in sync by hand.
- **class-validator on a config class:** consistent with DTO validation, but more boilerplate and
  weaker coercion for plain environment strings.
- **No validation:** rejected; it defers configuration errors to runtime.

## Consequences

- Misconfiguration is caught immediately, with a readable error.
- Adding a variable means updating the schema and `.env.example`; types follow automatically.
- Adds `zod` as a runtime dependency (small, no transitive dependencies).
