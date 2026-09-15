# API Contract

> **Status:** Draft. This contract is the source of truth for the API and evolves with implementation.
> Live, interactive documentation will be available via Swagger at `/api/docs`.

## Conventions

| Topic          | Convention                                                                    |
| -------------- | ----------------------------------------------------------------------------- |
| Base URL       | `/api/v1`                                                                     |
| Format         | JSON only (`Content-Type: application/json`)                                  |
| Field naming   | `camelCase`                                                                   |
| IDs            | UUID v4 strings                                                               |
| Timestamps     | ISO 8601 in UTC, e.g. `2026-09-15T10:30:00.000Z`                              |
| Authentication | `Authorization: Bearer <accessToken>` on every endpoint not marked **Public** |
| Unknown fields | Rejected with `400 Bad Request`                                               |

## Response shapes

### Single resource

```json
{
  "data": { "id": "…", "title": "…" }
}
```

### Paginated list

```json
{
  "data": [{ "id": "…" }],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

### Error

Every error, from any endpoint, uses the same shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "email must be a valid email address" }
  ],
  "path": "/api/v1/auth/register",
  "timestamp": "2026-09-15T10:30:00.000Z"
}
```

`details` is present only for validation errors.

---

## Auth

### `POST /auth/register` (Public)

Creates an account and signs the user in.

| Field      | Type   | Rules                                   |
| ---------- | ------ | --------------------------------------- |
| `name`     | string | required, 2–100 chars                   |
| `email`    | string | required, valid email, stored lowercase |
| `password` | string | required, 8–128 chars                   |

**Responses**

- `201 Created`: `{ data: { user, tokens } }`
- `400 Bad Request`: validation failed
- `409 Conflict`: email already registered
- `429 Too Many Requests`: rate limit exceeded

### `POST /auth/login` (Public)

| Field      | Type   | Rules    |
| ---------- | ------ | -------- |
| `email`    | string | required |
| `password` | string | required |

**Responses**

- `200 OK`: `{ data: { user, tokens } }`
- `401 Unauthorized`: `Invalid credentials` (the same message whether the email or the password is wrong)
- `429 Too Many Requests`

### `POST /auth/refresh` (Public, requires a valid refresh token)

| Field          | Type   | Rules    |
| -------------- | ------ | -------- |
| `refreshToken` | string | required |

Issues a **new** token pair and invalidates the old refresh token (rotation).
Reusing an already-rotated refresh token revokes **all** of the user's sessions.

**Responses**

- `200 OK`: `{ data: { tokens } }`
- `401 Unauthorized`: invalid, expired, revoked or reused token

### `POST /auth/logout`

Revokes the current session.

- `204 No Content`
- `401 Unauthorized`

### `POST /auth/logout-all`

Revokes every session of the current user (all devices).

- `204 No Content`
- `401 Unauthorized`

### Token object

```json
{
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

`expiresIn` is the access token lifetime in seconds.

---

## Users

### `GET /users/me`

- `200 OK`: `{ data: user }`
- `401 Unauthorized`

### User object

```json
{
  "id": "3f1c…",
  "name": "Alex Carter",
  "email": "alex@example.com",
  "createdAt": "2026-09-15T10:30:00.000Z",
  "updatedAt": "2026-09-15T10:30:00.000Z"
}
```

`passwordHash` is **never** returned.

---

## Notes

All note endpoints are scoped to the authenticated user. A note owned by another user is
indistinguishable from a note that does not exist (`404`).

### `POST /notes`

| Field      | Type    | Rules                                    |
| ---------- | ------- | ---------------------------------------- |
| `title`    | string  | required, 1–255 chars                    |
| `content`  | string  | optional, max 50,000 chars, default `""` |
| `isPinned` | boolean | optional, default `false`                |

- `201 Created`: `{ data: note }`
- `400 Bad Request`

### `GET /notes`

| Query param  | Type    | Default     | Rules                                 |
| ------------ | ------- | ----------- | ------------------------------------- |
| `page`       | integer | `1`         | ≥ 1                                   |
| `limit`      | integer | `20`        | 1–100                                 |
| `search`     | string  | none        | matches title or content              |
| `isPinned`   | boolean | none        | filter                                |
| `isArchived` | boolean | `false`     | filter                                |
| `sortBy`     | enum    | `updatedAt` | `createdAt` \| `updatedAt` \| `title` |
| `sortOrder`  | enum    | `desc`      | `asc` \| `desc`                       |

- `200 OK`: paginated list of notes
- `400 Bad Request`: invalid query params

### `GET /notes/:id`

- `200 OK`: `{ data: note }`
- `400 Bad Request`: `id` is not a valid UUID
- `404 Not Found`

### `PATCH /notes/:id`

Partial update. At least one field is required.

| Field        | Type    | Rules            |
| ------------ | ------- | ---------------- |
| `title`      | string  | 1–255 chars      |
| `content`    | string  | max 50,000 chars |
| `isPinned`   | boolean |                  |
| `isArchived` | boolean |                  |

- `200 OK`: `{ data: note }`
- `400 Bad Request`
- `404 Not Found`

### `DELETE /notes/:id`

Soft delete: the note is hidden from every endpoint but kept in the database.

- `204 No Content`
- `404 Not Found`

### Note object

```json
{
  "id": "9a2b…",
  "title": "Grocery list",
  "content": "Milk, eggs 🥚",
  "isPinned": false,
  "isArchived": false,
  "createdAt": "2026-09-15T10:30:00.000Z",
  "updatedAt": "2026-09-15T10:30:00.000Z"
}
```
