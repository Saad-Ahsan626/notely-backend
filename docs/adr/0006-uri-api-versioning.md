# 0006. Version the API in the URI

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

The API's main client is a Flutter mobile app. Installed app versions can't be force-updated, so
old clients keep calling the API long after a new release. A breaking change to a response shape
would break those users unless old and new contracts can be served side by side.

## Decision

- All routes are served under the global prefix `api` with **URI versioning**:
  `/api/v1/notes`.
- The default version is `1`, so controllers don't need to declare it explicitly.
- A breaking change introduces `v2` for the affected routes while `v1` keeps working until old
  clients are retired.
- Prefix and versioning are configured in `configureApp()` (`src/app.setup.ts`), shared by
  `main.ts` and the e2e tests.

### Alternatives considered

| Strategy      | Example                                  | Why not chosen                                          |
| ------------- | ---------------------------------------- | ------------------------------------------------------- |
| Header        | `Accept-Version: 1`                      | Invisible in URLs and logs; harder to test in a browser |
| Media type    | `Accept: application/vnd.notely.v1+json` | Precise but verbose for a small API                     |
| Query param   | `/notes?v=1`                             | Easy to omit; mixes versioning with filtering           |
| No versioning | `/notes`                                 | Breaking changes would break installed mobile apps      |

## Consequences

- The version is explicit in every URL, log line and API document.
- Unversioned paths (`/health`, `/api/health`) return `404`.
- Supporting multiple versions later means maintaining multiple controllers or handlers for the
  affected routes.
