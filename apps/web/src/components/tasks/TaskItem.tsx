import type { Task, TaskStatusFilter } from "@workspace/common"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useDeleteTask, usePendingTaskChange, useUpdateTask } from "../../hooks/use-tasks"
import { ApiError } from "../../lib/api-client"
import { ROW_EXIT_MS } from "../../lib/row-exit"
import { TaskTitleEditor } from "./TaskTitleEditor"

interface TaskItemProps {
  task: Task
  statusFilter: TaskStatusFilter
  isNew: boolean
  onFailure: (error: unknown) => void
}

type RowAnimation = "in" | "grow" | "saved" | "none"

// Each plays once; ending on "none" keeps a finished row from replaying its entrance.
const ROW_ANIMATIONS = {
  in: "motion-safe:animate-task-in",
  grow: "motion-safe:animate-task-grow",
  saved: "motion-safe:animate-task-saved",
  none: "",
} as const satisfies Record<RowAnimation, string>

const ICON_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"

/** One change to a task at a time: its controls are disabled until the change and the reload after it are done. */
export function TaskItem({ task, statusFilter, isNew, onFailure }: TaskItemProps) {
  // The version the editor opened at, so a reload while editing cannot make the save overwrite a newer title.
  const [editedVersion, setEditedVersion] = useState<number | null>(null)
  const [animation, setAnimation] = useState<RowAnimation>(isNew ? "grow" : "in")
  const updateTask = useUpdateTask(task.id, onFailure)
  const deleteTask = useDeleteTask(task.id, onFailure)
  const pendingChange = usePendingTaskChange(task.id)
  const { isBusy } = pendingChange
  const shownTask = { ...task, ...pendingChange.patch }
  const isLeaving = pendingChange.isDeleting || !matchesFilter(shownTask, statusFilter)
  const isEntering = animation === "grow"

  function toggleCompleted(completed: boolean): void {
    updateTask.mutate({
      patch: { completed },
      version: task.version,
      leavesList: !matchesFilter({ ...task, completed }, statusFilter),
    })
  }

  function saveTitle(title: string, version: number): void {
    if (title === task.title) {
      setEditedVersion(null)
      return
    }

    // The editor stays open with the draft until the save succeeds; a conflict closes it to show the newer title.
    updateTask.mutate(
      { patch: { title }, version, leavesList: false },
      {
        onSuccess: () => {
          setEditedVersion(null)
          setAnimation("saved")
        },
        onError: (error) => {
          if (isVersionMismatch(error)) {
            setEditedVersion(null)
          }
        },
      },
    )
  }

  if (editedVersion !== null) {
    return (
      <li className="py-3 motion-safe:animate-task-in">
        <TaskTitleEditor
          title={task.title}
          isSaving={updateTask.isPending}
          onSave={(title) => saveTitle(title, editedVersion)}
          onCancel={() => setEditedVersion(null)}
        />
      </li>
    )
  }

  return (
    <li
      data-state={pickRowState(isLeaving, isEntering)}
      inert={isLeaving}
      onAnimationEnd={() => setAnimation("none")}
      style={{ transitionDuration: `${ROW_EXIT_MS}ms` }}
      className={`grid rounded-lg transition-[grid-template-rows,opacity] ease-in motion-reduce:transition-none ${
        isLeaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
      } ${ROW_ANIMATIONS[animation]}`}
    >
      <div className={`min-h-0 ${isLeaving || isEntering ? "overflow-hidden" : ""}`}>
        <div className="flex items-center gap-3 py-3">
          <input
            type="checkbox"
            checked={shownTask.completed}
            disabled={isBusy}
            onChange={(event) => toggleCompleted(event.target.checked)}
            aria-label={`Mark "${shownTask.title}" as ${shownTask.completed ? "not done" : "done"}`}
            className="size-5 shrink-0 cursor-pointer accent-brand-600 disabled:cursor-not-allowed transition-transform motion-safe:checked:scale-110"
          />
          <span
            className={`min-w-0 flex-1 break-words transition-colors duration-300 ${shownTask.completed ? "text-gray-400 line-through" : ""}`}
          >
            {shownTask.title}
          </span>
          <button
            type="button"
            onClick={() => setEditedVersion(task.version)}
            disabled={isBusy}
            aria-label={`Edit "${task.title}"`}
            className={ICON_BUTTON}
          >
            <Pencil className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => deleteTask.mutate()}
            disabled={isBusy}
            aria-label={`Delete "${task.title}"`}
            className={ICON_BUTTON}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  )
}

function isVersionMismatch(error: unknown): boolean {
  return error instanceof ApiError && error.status === 412
}

function matchesFilter(task: Task, statusFilter: TaskStatusFilter): boolean {
  return statusFilter === "all" || task.completed === (statusFilter === "completed")
}

function pickRowState(isLeaving: boolean, isEntering: boolean): "leaving" | "entering" | undefined {
  if (isLeaving) {
    return "leaving"
  }

  return isEntering ? "entering" : undefined
}
