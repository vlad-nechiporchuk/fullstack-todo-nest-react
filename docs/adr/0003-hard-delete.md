# 0003: Hard delete

- **Status:** accepted
- **Date:** 2026-11-01

## Context

The task asks for removing tasks. Nothing asks for restoring them, for an audit trail, or for reports over deleted
tasks.

## Decision

`DELETE /api/v1/tasks/:id` removes the row. A deleted task answers `404` afterwards, like one that never existed.

## Rejected alternatives

- **Soft delete (`deleted_at`).** Every query, count and future unique index has to remember the filter, and one that
  forgets shows deleted tasks. It buys a restore feature nobody asked for.
- **Undo in the UI.** Left out of the web app's scope, so nothing needs a deleted task back.

## Consequences

- A deleted task cannot be recovered except from a database backup.
- If restore or audit becomes a requirement, the change is a migration adding `deleted_at` plus a filter in the DAO,
  the only layer that touches the table.
