# 0011. JWT access tokens with rotating opaque refresh tokens

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

The API authenticates a Flutter mobile app. Installed apps keep users signed in for weeks, so a
single long-lived credential would be both convenient and dangerous. Authentication must support
logout on one device, logout everywhere, and a response to a stolen token.

## Decision

### Two tokens

|             | Access token                            | Refresh token                     |
| ----------- | --------------------------------------- | --------------------------------- |
| Format      | JWT, HS256                              | Opaque `sessionId.secret`         |
| Lifetime    | 15 minutes (`ACCESS_TOKEN_TTL_MINUTES`) | 7 days (`REFRESH_TOKEN_TTL_DAYS`) |
| Verified by | Signature, `iss`, `aud`, `exp`          | SHA-256 hash lookup in `sessions` |

**Access tokens** carry `sub` (user) and `sid` (session). Verification pins **HS256**, blocking
`alg: none` and algorithm-confusion attacks, and checks issuer and audience so a token minted by
another system is rejected.

**Refresh tokens are opaque, not JWTs.** They are checked against the database on every use anyway
(that is what makes revocation possible), so a self-contained token would add a second signing
secret and leak the user and session IDs to anyone holding it, while enabling the dangerous
shortcut of skipping the database check. The token is `sessionId.secret`: the session ID is an
address (a primary-key lookup), and only the 256-bit random secret authenticates. Only
`SHA-256(secret)` is stored, and comparison is constant-time.

### Rotation and reuse detection

Each refresh issues a new secret and invalidates the old one, using a conditional update
(`UPDATE ... WHERE refresh_token_hash = <presented>`), so two concurrent refreshes cannot both
succeed. Presenting an already-rotated token means two parties hold it, so **all sessions of that
user are revoked** and the event is logged.

### Stateful access tokens

The guard also verifies that the token's session is still active. Logout and "log out everywhere"
therefore take effect immediately, at the cost of one primary-key lookup per request.

### Guard implementation

A custom `JwtAuthGuard` using `@nestjs/jwt`, registered globally with `APP_GUARD`; routes opt out
with `@Public()`. Passport was not added: it brings extra dependencies and indirection, and its
main benefit (many strategies) does not apply to a single JWT strategy.

### Brute-force protection

Login and registration are limited per IP by a small in-process `RateLimitGuard`
(`AUTH_RATE_LIMIT_PER_MINUTE`, default 5/minute), returning 429 with `Retry-After`.
`@nestjs/throttler` was not used because its latest release (6.5.0) does not support NestJS 12.

## Consequences

- A stolen access token is useful for at most 15 minutes; a stolen refresh token is detected the
  moment either party uses it twice.
- The client **must refresh one request at a time**; parallel refreshes would trip reuse detection.
  Documented in the API contract's client guide.
- Rate-limit counters are per process. Running multiple instances needs a shared store (Redis), as
  does an access-token denylist if the per-request session check is ever dropped for scale.
- Sessions accumulate; expired rows should be cleaned up by a scheduled job (future phase).
