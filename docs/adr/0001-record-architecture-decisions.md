# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-09-15

## Context

Decisions about architecture, libraries and security trade-offs are made throughout the project.
Code shows _what_ was built, but not _why_ it was built that way or which alternatives were rejected.
Without that record, decisions get second-guessed or accidentally reversed later.

## Decision

Significant decisions are recorded as Architecture Decision Records in `docs/adr/`, using the format
described by Michael Nygard: **Context → Decision → Consequences**.

- Files are numbered sequentially: `NNNN-short-title.md`.
- An accepted ADR is not edited. If a decision changes, a new ADR supersedes it.

## Consequences

- The reasoning behind the design is visible to reviewers and future contributors.
- Writing an ADR forces alternatives to be considered before committing to one.
- Small overhead per decision; reserved for choices that are costly to reverse.
