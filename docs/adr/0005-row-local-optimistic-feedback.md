# 0005: Row-local optimistic feedback without optimistic cache updates

- **Status:** accepted
- **Date:** 2026-11-02

## Context

The first version of the web app edited the cached lists optimistically and queued changes to one task, so a second
click could go out before the first was confirmed. That needed snapshots of every list, count adjustments, rollbacks
and a remembered version per task, and two failed changes to one task in a row could leave the list showing a state
the server never had. Instant repeated clicks on one checkbox did not justify that many states in a small app.

## Decision

The cache holds only what the server returned.

- While a change is pending, the task's row shows it from the change's own input: ticked, renamed, or closing up when
  it no longer matches the open tab or is being deleted. The row reads the pending change from the mutation cache by
  task id, so a row that unmounts and comes back, as on a tab switch, still shows it. A change that closes up its row
  stays pending until the close-up transition has finished, so a fast response and reload cannot remove the row
  mid-transition.
- The task's controls are disabled while a change to that task is pending. Other tasks stay available.
- A change carries the version it was based on: the one shown when the checkbox or delete was clicked, or the one the
  title editor opened at, so a reload while editing cannot turn a stale draft into an overwrite. The editor keeps the
  draft until the save succeeds; on a version conflict it closes and shows the newer title.
- After every change, successful or not, the lists are reloaded. A failed change needs no rollback, because the cache
  was never touched.

## Rejected alternatives

- **Keep the optimistic cache and fix the rollback** by replaying the remaining queued changes on top of the last
  confirmed state. Correct, but it adds a layer to the part that was already the hardest to follow.
- **No immediate feedback,** the row changing only after the server answers. Simplest, but every click would wait for
  a round trip.

## Consequences

- Rows provide immediate visual feedback; list membership and tab counts are reconciled after the reload.
- A second change to the same task waits for the first change and the reload after it.
- If the reload fails, the list retains its last successfully fetched state, which may be stale even when the
  mutation succeeded.
- Revisit this decision if offline editing, frequent successive changes, or measured latency make the current
  interaction insufficient.
