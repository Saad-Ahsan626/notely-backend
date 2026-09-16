# 0013. Notes: owner scoping, offset pagination and soft delete

- **Status:** Accepted
- **Date:** 2026-09-16

## Context

Notes are private user data exposed through `/api/v1/notes`. Broken object level authorization
(BOLA, OWASP API Security #1) is the most common serious API flaw: an endpoint checks that the caller
is logged in, but not that the requested object belongs to them. The list endpoint also needs
pagination, search, filtering and sorting for a Flutter client.

## Decision

### Owner scoping

- Every query in `NotesRepository` requires the owner's ID and excludes soft-deleted rows; there is
  no method that loads a note by ID alone.
- The owner always comes from the access token (`@CurrentUser()`); a `userId` in a request body is
  rejected by the global validation whitelist.
- Another user's note is answered with **404**, not 403, so its existence is not revealed.
- Updates and deletes are single conditional statements
  (`UPDATE ... WHERE id = ? AND user_id = ? AND deleted_at IS NULL`), so ownership is checked and
  the change applied atomically, with no time-of-check/time-of-use race.

### Offset pagination

- `page` / `limit` (max 100, page max 10,000), returning `{ data, meta }` with `total` and
  `totalPages`. The page and the count run in one transaction so they describe the same snapshot.
- Ordering is **pinned notes first**, then the requested sort field, then `id` as a unique
  tie-breaker so no note repeats or disappears between pages.
- A page past the end returns empty `data`, not an error.

### Search

- `search` matches title or content with `LIKE`, case-insensitively through the table collation.
- `%`, `_` and `\` are escaped (`escapeLikePattern`), because Prisma does not escape them on MySQL:
  before the fix, searching `5%` matched `50%`.

### Soft delete

- `DELETE` sets `deleted_at`; deleted notes are invisible to every endpoint, and deleting again
  returns 404.

### Validation details

- `UpdateNoteDto` is written by hand instead of `PartialType(CreateNoteDto)`: `PartialType` applies
  `@IsOptional()`, which also skips `null`, and `null` would then fail on a `NOT NULL` column with a 500. A custom `@IsOptionalNotNull()` only skips absent fields.
- Query booleans accept only the strings `true` and `false`.

### Alternatives considered

- **Cursor pagination:** stable and fast for infinite scroll and very large collections, but no page
  numbers or totals. Per-user note counts are small, so offset is simpler and fast enough.
- **Hard delete:** simpler queries, but no recovery from mistakes.
- **403 for foreign notes:** leaks which IDs exist.

## Consequences

- `EXPLAIN` shows the list query using `notes_user_id_deleted_at_updated_at_idx` to find a user's
  notes; ordering by `is_pinned` is done in memory (filesort), which is negligible for one user's
  notes. If users reach thousands of notes, add an index on
  `(user_id, deleted_at, is_archived, is_pinned, updated_at, id)`.
- Soft-deleted rows accumulate; a scheduled purge (and a restore endpoint) are future work.

**Future work:** cursor pagination for infinite scroll, a MySQL `FULLTEXT` index for word search,
a restore endpoint, and optimistic concurrency (`version` / `If-Match`) so edits from two offline
devices cannot silently overwrite each other.
