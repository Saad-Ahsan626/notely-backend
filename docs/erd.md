# Entity Relationship Diagram

> **Status:** Draft. This will be implemented with Prisma in Phase 3.

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ notes : "owns"

    users {
        char id PK "UUID"
        varchar email UK "lowercase, max 255"
        varchar name "max 100"
        varchar password_hash "argon2id hash"
        datetime created_at
        datetime updated_at
    }

    sessions {
        char id PK "UUID"
        char user_id FK "on delete cascade"
        char refresh_token_hash "SHA-256 hex"
        varchar user_agent "nullable"
        varchar ip_address "nullable, IPv4 or IPv6"
        datetime expires_at
        datetime revoked_at "nullable"
        datetime created_at
    }

    notes {
        char id PK "UUID"
        char user_id FK "on delete cascade"
        varchar title "max 255"
        mediumtext content
        boolean is_pinned "default false"
        boolean is_archived "default false"
        datetime deleted_at "nullable, soft delete"
        datetime created_at
        datetime updated_at
    }
```

## Relationships

| Relationship         | Type        | On delete                                       |
| -------------------- | ----------- | ----------------------------------------------- |
| `users` → `sessions` | one-to-many | Cascade: deleting a user removes their sessions |
| `users` → `notes`    | one-to-many | Cascade: deleting a user removes their notes    |

## Indexes

| Table      | Index                               | Why                                                                 |
| ---------- | ----------------------------------- | ------------------------------------------------------------------- |
| `users`    | unique `email`                      | Login lookup, and it enforces one account per email                 |
| `sessions` | `user_id`                           | Used by "logout from all devices"                                   |
| `notes`    | `(user_id, deleted_at, updated_at)` | Matches the most common query: "my non-deleted notes, newest first" |

## Column type decisions

| Column               | Type                 | Reason                                                                                          |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| All `id` columns     | `CHAR(36)` UUID      | Non-guessable IDs prevent enumeration (`/notes/5` → `/notes/6`)                                 |
| `password_hash`      | `VARCHAR(255)`       | argon2id hashes are around 100 chars; leaves room for algorithm changes                         |
| `refresh_token_hash` | `CHAR(64)`           | A SHA-256 hex digest is always exactly 64 chars                                                 |
| `ip_address`         | `VARCHAR(45)`        | Longest textual IPv6 form (IPv4-mapped) is 45 chars                                             |
| `content`            | `MEDIUMTEXT`         | `TEXT` holds 65,535 **bytes**; with `utf8mb4` (up to 4 bytes per char) 50,000 chars may not fit |
| Timestamps           | `DATETIME(3)` in UTC | Millisecond precision; UTC avoids timezone bugs. Clients convert to local time                  |
| Table/column names   | `snake_case`         | MySQL convention; Prisma models stay `PascalCase` / `camelCase` via `@@map` / `@map`            |
