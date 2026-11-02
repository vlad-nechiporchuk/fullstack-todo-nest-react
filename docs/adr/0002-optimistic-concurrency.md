# 0002: Optimistic concurrency with ETag and If-Match

- **Status:** accepted
- **Date:** 2026-11-01

## Context

Two tabs, or two people, can change the same task. Without a check, the later write silently overwrites the earlier
one: a task one person completed comes back open because another renamed it from a stale copy.

## Decision

Every task carries an integer `version` that every change increments. The API returns it as an `ETag` header, and a
`PATCH` may send it back as `If-Match`.

- The update is one conditional `UPDATE ... WHERE id = :id AND version = ANY(:expected)`, so two concurrent updates
  with the same `If-Match` cannot both win; the database decides, not a read-then-write in the service.
- `If-Match` uses the strong comparison RFC 9110 requires. It may list several ETags; a weak one (`W/"3"`) or one this
  API never issues matches nothing, so a list of only such tags answers `412`. A header that is not an ETag list
  answers `400`.
- A stale `If-Match` answers `412` with a `version-mismatch` problem that names the current version.
- `If-Match` is optional, and `*` is accepted and applies no version check; a missing task answers `404` either way.
  A client that does not care about conflicts keeps working.
- The web app sends the version of the task as it was loaded. On `412` it tells the user someone else changed the
  task first and shows the reloaded list.

## Rejected alternatives

- **Last write wins.** Loses updates without telling anyone.
- **`updatedAt` as the version.** Timestamp precision and clock differences make two writes look equal.
- **Pessimistic locks (`SELECT ... FOR UPDATE`).** Holds a lock across a round trip for a conflict that is rare.

## Consequences

- Clients that want safety must keep the version they read.
- `DELETE` takes no `If-Match`, so a delete wins over a concurrent rename.
