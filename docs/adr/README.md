# Architecture Decision Records

An ADR captures one significant decision: the context, what was decided, and the consequences.
Records are immutable once accepted. A changed decision gets a **new** ADR that supersedes the old one.

| #                                                                     | Decision                                              | Status   |
| --------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)                         | Record architecture decisions                         | Accepted |
| [0002](0002-tech-stack.md)                                            | Use NestJS, Prisma and MySQL                          | Accepted |
| [0003](0003-zod-for-config-validation.md)                             | Validate environment configuration with Zod           | Accepted |
| [0004](0004-local-mysql-for-development.md)                           | Use a locally installed MySQL for development         | Accepted |
| [0005](0005-repository-pattern.md)                                    | Wrap Prisma in concrete repository classes            | Accepted |
| [0006](0006-uri-api-versioning.md)                                    | Version the API in the URI                            | Accepted |
| [0007](0007-prisma-7-with-mariadb-adapter.md)                         | Use Prisma 7 with the MariaDB driver adapter          | Accepted |
| [0008](0008-uuidv7-primary-keys.md)                                   | Use UUIDv7 primary keys                               | Accepted |
| [0009](0009-class-validator-for-request-validation.md)                | Validate requests with class-validator DTOs           | Accepted |
| [0010](0010-structured-logging-with-pino.md)                          | Structured logging with pino                          | Accepted |
| [0011](0011-jwt-access-tokens-with-rotating-opaque-refresh-tokens.md) | JWT access tokens with rotating opaque refresh tokens | Accepted |
| [0012](0012-argon2id-password-storage.md)                             | Store passwords as argon2id hashes                    | Accepted |
