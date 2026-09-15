# Notely API

[![CI](https://github.com/Saad-Ahsan626/notely-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/Saad-Ahsan626/notely-backend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-24_LTS-339933?logo=nodedotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)

A production-grade REST API for a note-taking app, built with **NestJS**, **Prisma** and **MySQL**.
It is the backend for a Flutter client and focuses on secure authentication, clean modular
architecture and professional engineering practices.

## Features

- [x] Modular, layered architecture (controller → service → repository)
- [x] Validated, typed environment configuration (fails fast on misconfiguration)
- [x] Versioned API (`/api/v1`) with a health endpoint
- [x] Strict TypeScript, type-aware linting, formatting, git hooks and CI
- [x] MySQL schema, versioned migrations and idempotent seed data with Prisma 7
- [x] Liveness and readiness health checks (readiness verifies the database)
- [x] CI against a real MySQL 8.4 database, including a schema drift check
- [x] Global request validation with mass-assignment protection
- [x] One consistent error format with request IDs; internal details never leak
- [x] Structured JSON logging (pino) with request correlation and secret redaction
- [x] Security headers (helmet), configurable CORS and request size limits
- [ ] Registration and login with argon2id password hashing
- [ ] JWT access tokens with refresh token rotation and reuse detection
- [ ] Logout from the current device or all devices
- [ ] Notes CRUD with pagination, search, filtering and soft delete, scoped to the owner
- [ ] Rate limiting
- [ ] Interactive OpenAPI (Swagger) documentation
- [ ] Unit and end-to-end test suites against a real database

## Tech stack

| Area         | Choice                                            |
| ------------ | ------------------------------------------------- |
| Runtime      | Node.js 24 LTS, ES modules                        |
| Framework    | NestJS 12 (Express)                               |
| Language     | TypeScript (strict)                               |
| Database     | MySQL 8                                           |
| ORM          | Prisma 7 (MariaDB driver adapter), UUIDv7 keys    |
| Config       | `@nestjs/config` + Zod                            |
| Testing      | Vitest, Supertest                                 |
| Validation   | class-validator, class-transformer                |
| Logging      | pino (nestjs-pino)                                |
| Security     | helmet, CORS allow-list                           |
| Code quality | oxlint (type-aware), Prettier, Husky, lint-staged |
| CI           | GitHub Actions                                    |

## Getting started

### Prerequisites

- Node.js **24.15** or newer (see [`.nvmrc`](.nvmrc))
- MySQL **8.0** or newer, running locally

### Setup

```bash
git clone https://github.com/Saad-Ahsan626/notely-backend.git
cd notely-backend
npm install
```

Create the databases and application user (asks for your MySQL root password):

```bash
npm run db:init
```

Create your environment file:

```bash
cp .env.example .env
```

Create the tables:

```bash
npm run db:deploy
```

Optionally load demo data (login: `demo@notely.dev` / `DemoPassword123!`, local only):

```bash
npm run db:seed
```

Start the API in watch mode:

```bash
npm run start:dev
```

Check that it's running and connected to the database:

```bash
curl http://localhost:3000/api/v1/health/ready
```

Full database instructions and troubleshooting: [docs/local-database-setup.md](docs/local-database-setup.md).

## Environment variables

| Variable              | Required         | Default       | Description                                                    |
| --------------------- | ---------------- | ------------- | -------------------------------------------------------------- |
| `NODE_ENV`            | No               | `development` | `development`, `test` or `production`                          |
| `PORT`                | No               | `3000`        | HTTP port                                                      |
| `DATABASE_URL`        | Yes              | none          | `mysql://USER:PASSWORD@HOST:PORT/DATABASE`                     |
| `DATABASE_POOL_SIZE`  | No               | `10`          | Maximum open database connections (1–100)                      |
| `SHADOW_DATABASE_URL` | For `db:migrate` | none          | Prisma CLI only: scratch database for creating migrations      |
| `LOG_LEVEL`           | No               | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `CORS_ORIGINS`        | No               | none          | Comma-separated browser origins allowed by CORS                |
| `TRUST_PROXY`         | No               | `false`       | `true` only behind a trusted reverse proxy                     |

Variables are validated at startup. The app refuses to start and lists every problem if any value
is missing or invalid.

## Scripts

| Script               | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm run start:dev`  | Start in watch mode                                |
| `npm run build`      | Compile to `dist/`                                 |
| `npm run start:prod` | Run the compiled app                               |
| `npm run check`      | Format check, lint, type check and unit tests      |
| `npm run lint`       | Type-aware lint (warnings fail)                    |
| `npm run typecheck`  | Type check `src` and `test` without emitting       |
| `npm run format`     | Format all files with Prettier                     |
| `npm test`           | Unit tests                                         |
| `npm run test:e2e`   | End-to-end tests                                   |
| `npm run test:cov`   | Unit tests with coverage                           |
| `npm run db:init`    | Create local databases and the application user    |
| `npm run db:migrate` | Create and apply a migration after a schema change |
| `npm run db:deploy`  | Apply existing migrations                          |
| `npm run db:status`  | Show applied and pending migrations                |
| `npm run db:seed`    | Load demo data (refuses to run in production)      |
| `npm run db:studio`  | Browse data in Prisma Studio                       |
| `npm run db:reset`   | ⚠️ Drop local data and re-run all migrations       |

## API

Base URL: `http://localhost:3000/api/v1`

| Method | Endpoint        | Description                | Status  |
| ------ | --------------- | -------------------------- | ------- |
| GET    | `/health`       | Liveness check             | ✅ Live |
| GET    | `/health/ready` | Readiness check (database) | ✅ Live |
| POST   | `/auth/*`       | Authentication             | Planned |
| GET    | `/users/me`     | Current user               | Planned |
| \*     | `/notes`        | Notes CRUD                 | Planned |

The complete contract, including request rules, responses and error format, is in
[docs/api-contract.md](docs/api-contract.md).

## Project structure

```text
src/
├── main.ts            # Bootstrap
├── app.setup.ts       # Shared app configuration (prefix, versioning, shutdown hooks)
├── app.module.ts      # Root module
├── common/            # Validation, error filter, response envelope, request IDs
├── config/            # Environment schema and validation
├── database/          # Prisma service and database module
├── logger/            # Structured logging configuration
└── modules/           # Feature modules: health, auth, users, notes
prisma/                # Schema, migrations and seed
test/                  # End-to-end tests
docs/                  # Architecture, API contract, ERD, ADRs
scripts/db/            # Local database setup
```

## Documentation

- [Architecture](docs/architecture.md): layers, modules and request lifecycle
- [API contract](docs/api-contract.md): endpoints, payloads and error format
- [Entity relationship diagram](docs/erd.md): database design and column decisions
- [Architecture Decision Records](docs/adr/README.md): why key decisions were made
- [Local database setup](docs/local-database-setup.md)

## Quality workflow

- **Pre-commit:** staged files are linted and formatted automatically (Husky + lint-staged).
- **Pre-push:** type check and unit tests.
- **CI:** every push to `main` and every pull request runs formatting, linting, type checking, unit
  and end-to-end tests, and a production build.

## License

[MIT](LICENSE) © Muhammad Saad Ahsan
