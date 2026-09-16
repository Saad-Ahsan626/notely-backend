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
succeed. The hash the session rotated away from is kept in `previous_refresh_token_hash`.

- Presenting **that previous secret** again means two parties hold the token, so **all sessions
  of the user are revoked** and the event is logged.
- Any **other** wrong secret is only a `401`. The session ID is not secret (it is the `sid` claim
  of every access token), so a guessed secret must never be able to log a user out everywhere.
  An earlier version treated every mismatch as reuse, which let anyone who had seen an old access
  token revoke all of that user's sessions.
- Only one previous hash is kept: a token from two or more rotations ago is a plain `401`.
- Sessions use a sliding expiry: each refresh extends `expires_at` by `REFRESH_TOKEN_TTL_DAYS`.

### Stateful access tokens

The guard also verifies that the token's session is still active. Logout and "log out everywhere"
therefore take effect immediately, at the cost of one primary-key lookup per request.

### Guard implementation

A custom `JwtAuthGuard` using `@nestjs/jwt`, registered globally with `APP_GUARD`; routes opt out
with `@Public()`. Passport was not added: it brings extra dependencies and indirection, and its
main benefit (many strategies) does not apply to a single JWT strategy.

### Brute-force protection

Login, registration and token refresh are limited per IP by a small in-process `RateLimitGuard`
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
- Client IPs come from `X-Forwarded-For` only for the configured number of proxy hops
  (`TRUST_PROXY`, default 0). Trusting every hop would let clients choose their own IP and bypass
  the rate limit. Forwarded values that are not valid IP addresses are never stored.
- Clients behind one shared IP (large offices, carrier NAT) share the refresh limit.
