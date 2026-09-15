# 0005. Wrap Prisma in concrete repository classes

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Services contain business rules such as "a note belongs to its owner" and "an email is unique".
They need data access, which Prisma provides. Two concerns arise if services call Prisma directly:

1. **Testability:** unit testing a service would require mocking Prisma's generated, deeply chained
   client (`prisma.note.findFirst({ where: ... })`).
2. **Consistency and security:** rules that every query must follow, such as scoping notes to
   `userId` and excluding soft-deleted rows, would be repeated in many service methods, where one
   omission creates a data leak (broken object level authorization).

## Decision

Each feature that stores data has a **concrete repository class** (e.g. `NotesRepository`),
registered as a Nest provider, that wraps `PrismaService`.

- Repositories expose intention-revealing methods, e.g. `findOwnedById(noteId, userId)`.
- Owner scoping and soft-delete filtering are implemented once, inside the repository.
- Services depend on repositories, never on `PrismaService` directly.
- Unit tests replace the repository with a simple mock via `{ provide: NotesRepository, useValue }`.

### Alternatives considered

- **Services call Prisma directly:** less code, but harder to unit test and security rules get
  duplicated.
- **Abstract repository contract + Prisma implementation** (full dependency inversion): enables
  swapping persistence technologies. TypeScript interfaces don't exist at runtime, so this needs an
  abstract class or injection token per repository. Rejected for now: there is only one
  implementation, so the extra indirection adds cost without benefit.

## Consequences

- Services are easy to unit test and read as business logic only.
- Data-access rules live in one place per feature.
- One extra class per feature.
- If a second persistence implementation is ever needed, the concrete class can be turned into an
  abstract contract without changing services.
