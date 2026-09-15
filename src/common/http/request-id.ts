import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Short, log-safe identifiers only: no spaces, line breaks or control characters. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * Reuses a client-provided request ID so a request can be traced end to end, but only when
 * it is well-formed. Anything else is replaced, because a crafted header value could inject
 * fake lines into the logs.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;

  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate)
    ? candidate
    : randomUUID();
}
