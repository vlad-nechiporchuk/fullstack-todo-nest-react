import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import type { Task, TaskCounts, TaskPage, TaskStatusFilter, UpdateTask } from "@workspace/common"

export const TASK_KEYS = {
  all: ["tasks"] as const,
  lists: () => [...TASK_KEYS.all, "list"] as const,
  list: (status: TaskStatusFilter) => [...TASK_KEYS.lists(), status] as const,
  version: (id: string) => [...TASK_KEYS.all, "version", id] as const,
}

export type TaskPages = InfiniteData<TaskPage, number>

export type CachedLists = [readonly unknown[], TaskPages | undefined][]

/** One optimistic change to one task: the task before it, and after it (`null` once removed). */
export interface TaskChange {
  before: Task
  after: Task | null
}

export function snapshotLists(queryClient: QueryClient): CachedLists {
  return queryClient.getQueriesData<TaskPages>({ queryKey: TASK_KEYS.lists() })
}

/**
 * Undoes one failed change: the task goes back to where the snapshot had it and the counts lose its effect, while
 * every other task keeps the state it has now, including changes made after the snapshot.
 */
export function rollbackChange(queryClient: QueryClient, snapshot: CachedLists, change: TaskChange): void {
  const { id } = change.before
  const undoCounts = (counts: TaskCounts) => countTask(countTask(counts, change.after, -1), change.before, 1)

  for (const [key, snapshotList] of snapshot) {
    const current = queryClient.getQueryData<TaskPages>(key)
    if (!current || !snapshotList) {
      continue
    }

    const place = locateTask(snapshotList, id)
    let removed = 0
    const pages = current.pages.map((page, pageIndex) => {
      const items = page.items.filter((item) => item.id !== id)
      removed += page.items.length - items.length
      if (place?.pageIndex === pageIndex) {
        items.splice(place.itemIndex, 0, place.task)
      }

      return { ...page, items }
    })
    const restored = place ? 1 : 0

    queryClient.setQueryData(key, {
      ...current,
      pages: pages.map((page) => ({
        ...page,
        total: page.total - removed + restored,
        counts: undoCounts(page.counts),
      })),
    })
  }
}

/**
 * Remembers the version a task's changes start from, before an optimistic change can take the task out of a
 * filtered list; a version already remembered by an earlier queued change is kept.
 */
export function rememberVersion(queryClient: QueryClient, id: string): void {
  const version = findCachedTask(queryClient, id)?.version
  if (version !== undefined && queryClient.getQueryData(TASK_KEYS.version(id)) === undefined) {
    queryClient.setQueryData(TASK_KEYS.version(id), version)
  }
}

export function readVersion(queryClient: QueryClient, id: string): number {
  const version = queryClient.getQueryData<number>(TASK_KEYS.version(id))
  if (version === undefined) {
    throw new Error(`No version remembered for task ${id}`)
  }

  return version
}

export function confirmVersion(queryClient: QueryClient, id: string, version: number): void {
  queryClient.setQueryData(TASK_KEYS.version(id), version)
}

export function forgetVersion(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: TASK_KEYS.version(id), exact: true })
}

/** Counts change with the patch, and a task leaves the lists whose status filter it no longer matches. */
export function applyPatch(queryClient: QueryClient, id: string, patch: UpdateTask): TaskChange | undefined {
  const task = findCachedTask(queryClient, id)
  if (!task) {
    return undefined
  }

  const changed = { ...task, ...patch, completedAt: deriveCompletedAt(task, patch) }
  const adjustCounts = shiftCounts(task, changed)

  updateLists(queryClient, (list, status) =>
    rewriteList(
      list,
      (items) => items.flatMap((item) => (item.id !== id ? [item] : matches(changed, status) ? [changed] : [])),
      adjustCounts,
    ),
  )

  return { before: task, after: changed }
}

export function applyRemoval(queryClient: QueryClient, id: string): TaskChange | undefined {
  const task = findCachedTask(queryClient, id)
  if (!task) {
    return undefined
  }

  const status = task.completed ? "completed" : "active"

  updateLists(queryClient, (list) =>
    rewriteList(
      list,
      (items) => items.filter((item) => item.id !== id),
      (counts) => ({ ...counts, all: counts.all - 1, [status]: counts[status] - 1 }),
    ),
  )

  return { before: task, after: null }
}

/** Stores the task as the API returned it, so the next update names the version the API now holds. */
export function storeConfirmed(queryClient: QueryClient, confirmed: Task): void {
  updateLists(queryClient, (list) =>
    rewriteList(list, (items) => items.map((item) => (item.id === confirmed.id ? confirmed : item))),
  )
}

export function storeConfirmedVersion(queryClient: QueryClient, confirmed: Task): void {
  updateLists(queryClient, (list) =>
    rewriteList(list, (items) =>
      items.map((item) =>
        item.id === confirmed.id ? { ...item, version: confirmed.version, updatedAt: confirmed.updatedAt } : item,
      ),
    ),
  )
}

function findCachedTask(queryClient: QueryClient, id: string): Task | undefined {
  for (const [, list] of snapshotLists(queryClient)) {
    for (const page of list?.pages ?? []) {
      const task = page.items.find((item) => item.id === id)
      if (task) {
        return task
      }
    }
  }

  return undefined
}

function updateLists(queryClient: QueryClient, update: (list: TaskPages, status: TaskStatusFilter) => TaskPages): void {
  for (const [key, list] of snapshotLists(queryClient)) {
    if (list) {
      queryClient.setQueryData(key, update(list, key[2] as TaskStatusFilter))
    }
  }
}

// Every page carries the list's total and counts, so a removal from one page lowers them on all of them.
function rewriteList(
  list: TaskPages,
  mapItems: (items: Task[]) => Task[],
  adjustCounts: (counts: TaskCounts) => TaskCounts = (counts) => counts,
): TaskPages {
  let removed = 0
  const pages = list.pages.map((page) => {
    const items = mapItems(page.items)
    removed += page.items.length - items.length

    return { ...page, items }
  })

  return {
    ...list,
    pages: pages.map((page) => ({ ...page, total: page.total - removed, counts: adjustCounts(page.counts) })),
  }
}

function deriveCompletedAt(task: Task, patch: UpdateTask): string | null {
  if (patch.completed === undefined) {
    return task.completedAt
  }

  return patch.completed ? (task.completedAt ?? new Date().toISOString()) : null
}

function shiftCounts(before: Task, after: Task): (counts: TaskCounts) => TaskCounts {
  if (before.completed === after.completed) {
    return (counts) => counts
  }

  const shift = after.completed ? 1 : -1

  return (counts) => ({ ...counts, active: counts.active - shift, completed: counts.completed + shift })
}

function matches(task: Task, status: TaskStatusFilter): boolean {
  return status === "all" || task.completed === (status === "completed")
}

function locateTask(list: TaskPages, id: string): { pageIndex: number; itemIndex: number; task: Task } | undefined {
  for (const [pageIndex, page] of list.pages.entries()) {
    const itemIndex = page.items.findIndex((item) => item.id === id)
    const task = page.items[itemIndex]
    if (task) {
      return { pageIndex, itemIndex, task }
    }
  }

  return undefined
}

function countTask(counts: TaskCounts, task: Task | null, sign: 1 | -1): TaskCounts {
  if (!task) {
    return counts
  }

  const status = task.completed ? "completed" : "active"

  return { ...counts, all: counts.all + sign, [status]: counts[status] + sign }
}
