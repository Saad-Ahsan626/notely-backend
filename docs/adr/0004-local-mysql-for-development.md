# 0004. Use a locally installed MySQL for development

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Development needs a MySQL server. The two common options are a **Docker Compose** service
(identical, disposable environment for every developer) or a **locally installed** MySQL server.
The project currently has a single developer, who already runs MySQL 8.0 locally and does not
have Docker installed.

## Decision

Use the locally installed MySQL server for development, and make its setup reproducible as code:

- [`scripts/db/init.sql`](../../scripts/db/init.sql) creates the `notely_dev`, `notely_test` and
  `notely_shadow` databases (explicit `utf8mb4`) and a least-privilege `notely` user.
- [`docs/local-database-setup.md`](../local-database-setup.md) documents setup and troubleshooting.
- CI does **not** depend on this choice: GitHub Actions can run MySQL as a service container.

## Consequences

- No Docker requirement; lower setup cost today.
- Environments can drift (MySQL version, server settings) between machines. The documented minimum
  is MySQL 8.0, and the setup script pins charset and collation explicitly.
- The shadow database is pre-created so the app user does not need global `CREATE DATABASE`
  privileges when Prisma migrations are introduced.

**Revisit** when a second developer joins, when the MySQL version must match production exactly,
or when additional services (e.g. Redis) are added. At that point, a Docker Compose setup
supersedes this ADR.
