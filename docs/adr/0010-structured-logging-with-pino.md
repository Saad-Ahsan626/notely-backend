# 0010. Structured logging with pino

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Nest's default logger prints human-readable text. In production, logs must be searchable and
filterable ("every 500 in the last hour", "everything request X did"), must not contain secrets, and
must let a reported problem be traced to the exact request that caused it.

## Decision

Use **pino** through **nestjs-pino** as the application logger.

- **JSON lines** in every environment except `development`, which uses `pino-pretty` for readable,
  colored output. Logs go to stdout (Twelve-Factor App, factor XI).
- Nest's own logger is replaced (`app.useLogger`), with startup logs buffered until it is attached,
  so framework messages and `new Logger(...)` calls share the same format.
- **Request IDs:** every request gets an ID, returned in the `X-Request-Id` header and included in
  every log line and error response. A client-provided `X-Request-Id` is reused only if it matches
  `^[A-Za-z0-9._-]{1,64}$`, preventing log injection. Node's `AsyncLocalStorage` carries the ID to
  logs written anywhere during the request.
- **Levels:** `LOG_LEVEL` controls verbosity (`silent` in tests). Completed requests log at `info`
  for 2xx/3xx, `warn` for 4xx and `error` for 5xx. The exception filter additionally logs 5xx errors
  with their stack trace.
- **Redaction:** `Authorization`, cookies and any `password`, `passwordHash`, `refreshToken` or
  `accessToken` field are replaced with `[Redacted]`.
- **Noise control:** health probes are not logged; response logs contain only the status code.

### Alternatives considered

- **Nest's built-in logger:** plain text by default; its JSON mode lacks request context and
  redaction.
- **winston:** flexible and popular, but slower and needs more setup for request context.

## Consequences

- Logs are ready for aggregation tools (Loki, Datadog, CloudWatch) without changes.
- Support can ask a user for the `requestId` from an error response and find every related log line.
- `console.log` is forbidden by the linter; all logging goes through the logger.
