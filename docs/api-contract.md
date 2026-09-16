# API Contract

> **Status:** Draft. This contract is the source of truth for the API and evolves with implementation.
> Live, interactive documentation will be available via Swagger at `/api/docs`.

## Conventions

| Topic          | Convention                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Base URL       | `/api/v1`                                                                                                                 |
| Format         | JSON only (`Content-Type: application/json`); other body types get `415`                                                  |
| Field naming   | `camelCase`                                                                                                               |
| IDs            | UUID strings (generated as time-ordered UUIDv7; clients must not rely on the version)                                     |
| Timestamps     | ISO 8601 in UTC, e.g. `2026-09-15T10:30:00.000Z`                                                                          |
| Authentication | `Authorization: Bearer <accessToken>` on every endpoint not marked **Public**                                             |
| Unknown fields | Rejected with `400 Bad Request`                                                                                           |
| Request IDs    | Every response has an `X-Request-Id` header. Send your own (`[A-Za-z0-9._-]`, max 64 chars) to trace a request end to end |
| Body size      | Request bodies are limited to 512 KB (`413 Payload Too Large`)                                                            |

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
  "timestamp": "2026-09-15T10:30:00.000Z",
  "requestId": "0192a6c4-3f1e-4b7a-9c2d-5e8f1a2b3c4d"
}
```

- `details` is present only for validation errors, with one entry per failed rule. Nested fields
  use dot paths (`tag.name`). When a value has the wrong type (for example a repeated query
  parameter arriving as a list), only the type error is listed for that field.
- `requestId` matches the `X-Request-Id` response header. Include it when reporting a problem.
- `path` never includes the query string.

Status codes common to all endpoints:

| Status | When                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------- |
| `400`  | Validation failed, unknown properties sent, or malformed JSON                                           |
| `404`  | Route or resource not found                                                                             |
| `409`  | Conflict with existing data (e.g. a duplicate unique value)                                             |
| `413`  | Request body larger than 512 KB                                                                         |
| `415`  | Body is not JSON, or uses an unsupported charset or encoding                                            |
| `429`  | Too many login, registration or refresh attempts from one IP (see `Retry-After`)                        |
| `500`  | Unexpected server error. The message is always `Internal server error`; details are only in server logs |

---

## Health

Health endpoints are for infrastructure (load balancers, uptime monitors) and are not wrapped in
`{ data }`.

### `GET /health` (Public)

Liveness: the process is running. Never touches the database.

- `200 OK`: `{ "status": "ok", "uptime": 42, "timestamp": "2026-09-15T10:30:00.000Z" }`

### `GET /health/ready` (Public)

Readiness: the API can serve requests because the database responds.

- `200 OK`: `{ "status": "ok", "database": "up" }`
- `503 Service Unavailable`: standard error format with `"message": "Database is unavailable"`

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
- `429 Too Many Requests`: more than `AUTH_RATE_LIMIT_PER_MINUTE` attempts (default 5) from one IP
  per minute; a `Retry-After` header says when to try again

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

- `200 OK`: `{ data: token object }` (see below)
- `401 Unauthorized`: invalid, expired, revoked or **reused** token. Replaying the token this
  session already rotated away from revokes every session of that user, so the app must ask
  the user to log in again. Any other wrong token is a plain 401 and logs nobody out.
- `429 Too Many Requests`: rate limit exceeded

### `POST /auth/logout`

Revokes the current session. The access token stops working immediately.

- `204 No Content`
- `401 Unauthorized`

### `POST /auth/logout-all`

Revokes every session of the current user (all devices).

- `204 No Content`
- `401 Unauthorized`

### Token object

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9.…",
  "refreshToken": "01a0a4eb-be81-7015-b47f-565f552f45b4.k7Pq9ZxR…",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

- **`accessToken`** is a JWT sent as `Authorization: Bearer …` on every protected request.
  `expiresIn` is its lifetime in seconds (15 minutes).
- **`refreshToken`** is an opaque `sessionId.secret` string, rotated on every use. A session
  expires after 7 days **without** a refresh; each refresh extends it by another 7 days. It is
  only ever sent to `/auth/refresh`.

### Client guide (Flutter)

1. **Store both tokens in secure storage** (`flutter_secure_storage`: Keychain / Keystore), never in
   plain preferences.
2. **On `401`,** call `/auth/refresh` once, then retry the failed request.
3. **Refresh one request at a time.** If several requests fail together, run a single refresh and
   let the others wait for it. Parallel refreshes look like a stolen token and log the user out
   everywhere.
4. **Replace both tokens** with every refresh response; the old refresh token is dead immediately.
5. **If refresh returns `401`,** clear the stored tokens and show the login screen.
6. Optionally send an `X-Request-Id` header to trace a request through the API logs.

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

All note endpoints require an access token and are scoped to the authenticated user. A note owned
by another user is indistinguishable from a note that does not exist (`404`). Deleted notes are
invisible to every endpoint.

### `POST /notes`

| Field      | Type    | Rules                                    |
| ---------- | ------- | ---------------------------------------- |
| `title`    | string  | required, 1–255 chars                    |
| `content`  | string  | optional, max 50,000 chars, default `""` |
| `isPinned` | boolean | optional, default `false`                |

- `201 Created`: `{ data: note }`, with a `Location: /api/v1/notes/{id}` header
- `400 Bad Request`: invalid input, `null` values, or unknown fields such as `userId`

The title is trimmed; a title of only spaces is rejected.

### `GET /notes`

| Query param  | Type    | Default     | Rules                                                                          |
| ------------ | ------- | ----------- | ------------------------------------------------------------------------------ |
| `page`       | integer | `1`         | ≥ 1                                                                            |
| `limit`      | integer | `20`        | 1–100                                                                          |
| `search`     | string  | none        | title or content, case-insensitive, max 100 chars; `%` and `_` match literally |
| `isPinned`   | boolean | none        | filter; only `true` or `false`                                                 |
| `isArchived` | boolean | `false`     | filter; archived notes are hidden by default                                   |
| `sortBy`     | enum    | `updatedAt` | `createdAt` \| `updatedAt` \| `title`                                          |
| `sortOrder`  | enum    | `desc`      | `asc` \| `desc`                                                                |

- `200 OK`: paginated list of notes. **Pinned notes always come first**, then the chosen sort.
  A page past the end returns an empty `data` array with the usual `meta`.
- `400 Bad Request`: invalid query params (`page` 1-10,000)

### `GET /notes/:id`

- `200 OK`: `{ data: note }`
- `400 Bad Request`: `id` is not a valid UUID
- `404 Not Found`

### `PATCH /notes/:id`

Partial update: fields that are not sent stay unchanged. At least one field is required, and `null`
is not accepted for any field (send `""` to clear the content).

| Field        | Type    | Rules            |
| ------------ | ------- | ---------------- |
| `title`      | string  | 1–255 chars      |
| `content`    | string  | max 50,000 chars |
| `isPinned`   | boolean |                  |
| `isArchived` | boolean |                  |

- `200 OK`: `{ data: note }`
- `400 Bad Request`: empty body, `null` values or invalid fields
- `404 Not Found`

### `DELETE /notes/:id`

Soft delete: the note is hidden from every endpoint but kept in the database.

- `204 No Content`
- `404 Not Found`: also returned when the note was already deleted

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
