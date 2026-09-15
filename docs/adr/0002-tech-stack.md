# 0002. Use NestJS, Prisma and MySQL

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Notely needs a REST API for a note-taking app with authentication and per-user data.
The stack should enforce a maintainable structure as the project grows, have strong TypeScript
support, and use a relational database, because the data (users → sessions, users → notes) is
naturally relational.

## Decision

### Framework: NestJS

Chosen over **plain Express** and **Fastify**.

- Built-in modules, dependency injection, guards, pipes and interceptors give an opinionated,
  consistent architecture instead of a hand-rolled one.
- First-class TypeScript and testing utilities.
- Express remains the underlying HTTP adapter, so the Express ecosystem is still available.

### ORM: Prisma

Chosen over **TypeORM** and **raw SQL**.

- The schema file is a single, readable source of truth for the data model.
- Generated client is fully type-safe: query results are typed from the schema.
- Migrations are generated from schema changes and versioned in git.
- Trade-off: complex queries are less flexible than raw SQL (raw queries remain available if needed).

### Database: MySQL

Chosen over **PostgreSQL** and **MongoDB**.

- The data is relational with clear foreign keys, which rules out a document store as the primary fit.
- MySQL is widely used in production and hosting, and it's the database I want to grow expertise in.
- PostgreSQL would be an equally valid choice; nothing in this design depends on MySQL-only features.

## Consequences

- A clear layered structure (controller → service → repository) comes naturally with Nest modules.
- Prisma's generated client must be regenerated whenever the schema changes.
- Switching to PostgreSQL later would mainly require a Prisma provider change and new migrations.
