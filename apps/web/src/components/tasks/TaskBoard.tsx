import type { Task, TaskCounts, TaskStatusFilter } from "@workspace/common"
import { useCallback, useState } from "react"
import { useStatusFilter } from "../../hooks/use-status-filter"
import { useTaskList } from "../../hooks/use-tasks"
import { describeError } from "../../lib/error-message"
import { ErrorState } from "../ui/ErrorState"
import { Notice } from "../ui/Notice"
import { FilterTabs } from "./FilterTabs"
import { TaskComposer } from "./TaskComposer"
import { TaskItem } from "./TaskItem"
import { TaskListSkeleton } from "./TaskListSkeleton"

const EMPTY_MESSAGES = {
  all: "No tasks yet. Add your first one above.",
  active: "Nothing left to do.",
  completed: "No completed tasks yet.",
} as const satisfies Record<TaskStatusFilter, string>

export function TaskBoard() {
  const [status, setStatus] = useStatusFilter()
  const [notice, setNotice] = useState<string | null>(null)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)
  const taskList = useTaskList(status)
  const pages = taskList.data?.pages
  const firstPage = pages?.[0]
  const tasks = pages && dedupeById(pages.flatMap((page) => page.items))
  const [lastCounts, setLastCounts] = useState<TaskCounts | undefined>(undefined)
  if (firstPage && firstPage.counts !== lastCounts) {
    setLastCounts(firstPage.counts)
  }
  // Counts do not depend on the tab, so the last known ones stay up while another tab loads for the first time.
  const counts = firstPage?.counts ?? lastCounts
  const reportFailure = useCallback((error: unknown) => setNotice(describeError(error)), [])

  return (
    <>
      <TaskComposer onCreated={(task) => setCreatedTaskId(task.id)} />

      <FilterTabs status={status} counts={counts} onStatusChange={setStatus} />

      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}

      {taskList.isPending && <TaskListSkeleton />}

      {taskList.isError && (
        <ErrorState
          message={`We couldn't load your tasks. ${describeError(taskList.error)}`}
          onRetry={() => taskList.refetch()}
        />
      )}

      {tasks && tasks.length === 0 && <p className="py-10 text-center text-gray-500">{EMPTY_MESSAGES[status]}</p>}

      {tasks && tasks.length > 0 && (
        <ul aria-label="Tasks" className="divide-y divide-gray-100 border-b border-gray-100">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              statusFilter={status}
              isNew={task.id === createdTaskId}
              onFailure={reportFailure}
            />
          ))}
        </ul>
      )}

      {taskList.hasNextPage && (
        <button
          type="button"
          onClick={() => taskList.fetchNextPage()}
          disabled={taskList.isFetchingNextPage}
          className="mt-4 w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          {taskList.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}

      {counts && (
        <p className="mt-5 text-sm text-gray-500" aria-live="polite">
          {counts.active} {counts.active === 1 ? "task" : "tasks"} remaining
        </p>
      )}
    </>
  )
}

// Offset pages can overlap when a task is added elsewhere between two loads.
function dedupeById(tasks: Task[]): Task[] {
  const seen = new Set<string>()

  return tasks.filter((task) => !seen.has(task.id) && seen.add(task.id))
}
