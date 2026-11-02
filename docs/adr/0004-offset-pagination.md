# 0004: Offset pagination with per-filter counts

- **Status:** accepted
- **Date:** 2026-11-01

## Context

The list must not return every task at once, and the UI shows a count on each tab (All, Active, Completed) whichever
tab is open.

## Decision

`GET /api/v1/tasks` takes `status`, `limit` (1 to 100, default 50) and `offset`, ordered newest first. Each page
carries `total` for its filter and `counts` for every filter. The DAO reads the page and the counts in one
transaction, so they come from the same snapshot and never disagree.

## Rejected alternatives

- **Keyset (cursor) pagination.** Stable under inserts and fast at any depth, but more contract for a list a person
  scrolls through. Offset cost grows with depth; at the sizes a ToDo list reaches it does not matter.
- **A separate counts endpoint.** One more request on every load and every change, and the two answers can disagree.

## Consequences

- A task created or deleted elsewhere while the user scrolls shifts later pages by one, so a task can appear on two
  pages; the web app shows it once. After each of its own changes the web app reloads every page it has loaded, so its
  own edits do not shift anything.
- Moving to keyset paging later changes the query parameters; the item shape stays.
