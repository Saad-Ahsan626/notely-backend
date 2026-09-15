# 0009. Validate requests with class-validator DTOs

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Every endpoint receives untrusted input (bodies, query strings, route parameters). Invalid or
unexpected data must be rejected before it reaches services, with errors a mobile client can map to
form fields. The project already uses Zod to validate environment variables (ADR 0003), so using Zod
for requests as well was a real option.

A specific risk is **mass assignment**: a client sending extra properties such as `userId` that a
careless service might pass straight to the database.

## Decision

- Request DTOs are classes validated with **class-validator** and transformed with
  **class-transformer**.
- One global `ValidationPipe` (registered with `APP_PIPE` in `CommonModule`) applies to every route:
  - `whitelist` + `forbidNonWhitelisted`: unknown properties are rejected with 400.
  - `transform`: payloads become DTO instances.
  - Implicit conversion is **disabled**; conversions are explicit (`@Type(() => Number)`), because
    implicit conversion turns the string `"false"` into `true`.
  - A custom exception factory flattens errors into `details: [{ field, message }]` with dot paths
    for nested fields (`tag.name`).
- Zod stays responsible for environment configuration, which is validated once at startup.

### Alternatives considered

- **Zod schemas for DTOs:** one library everywhere, but requires third-party bridges for NestJS
  pipes and for OpenAPI generation, and is less common in NestJS codebases.
- **Manual validation in services:** duplicated, easy to forget, and mixes HTTP concerns into
  business logic.

## Consequences

- DTOs work directly with the `@nestjs/swagger` CLI plugin (Phase 7).
- Services can trust their input: types and constraints are enforced at the edge.
- Two validation libraries exist in the project, each with a clearly separated job.
