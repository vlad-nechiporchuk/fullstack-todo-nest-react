import type { Task, TaskStatusFilter } from "@workspace/common"
import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useDeleteTask, useUpdateTask } from "../../hooks/use-tasks"
import { TaskTitleEditor } from "./TaskTitleEditor"

interface TaskItemProps {
  task: Task
  statusFilter: TaskStatusFilter
  isNew: boolean
  onFailure: (error: unknown) => void
}

// Matches duration-200 on the row, so the row has closed up when its request starts.
const EXIT_DURATION_MS = 200

type RowAnimation = "in" | "grow" | "saved" | "none"

// Each plays once; ending on "none" keeps a finished row from replaying its entrance.
const ROW_ANIMATIONS = {
  in: "motion-safe:animate-task-in",
  grow: "motion-safe:animate-task-grow",
  saved: "motion-safe:animate-task-saved",
  none: "",
} as const satisfies Record<RowAnimation, string>

const ICON_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-600"

export function TaskItem({ task, statusFilter, isNew, onFailure }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [leavingCompleted, setLeavingCompleted] = useState<boolean | null>(null)
  const isCompleted = leavingCompleted ?? task.completed
  const [animation, setAnimation] = useState<RowAnimation>(isNew ? "grow" : "in")
  const isEntering = animation === "grow"
  const updateTask = useUpdateTask(task.id, onFailure)
  const deleteTask = useDeleteTask(task.id, onFailure)

  function saveTitle(title: string): void {
    if (title !== task.title) {
      updateTask.mutate({ title })
      setAnimation("saved")
    }
    setIsEditing(false)
  }

  function toggleCompleted(completed: boolean): void {
    if (statusFilter === "all") {
      updateTask.mutate({ completed })
      return
    }

    // On a status tab the task no longer belongs once toggled, so it closes up like a deleted row.
    setLeavingCompleted(completed)
    leaveThen(() => updateTask.mutate({ completed }))
  }

  function leaveThen(action: () => void): void {
    if (prefersReducedMotion()) {
      action()
      return
    }

    setIsLeaving(true)
    // Not cancelled on unmount: switching tabs mid-animation must not undo what the person asked for.
    setTimeout(action, EXIT_DURATION_MS)
  }

  if (isEditing) {
    return (
      <li className="py-3 motion-safe:animate-task-in">
        <TaskTitleEditor title={task.title} onSave={saveTitle} onCancel={() => setIsEditing(false)} />
      </li>
    )
  }

  return (
    <li
      data-state={pickRowState(isLeaving, isEntering)}
      inert={isLeaving}
      onAnimationEnd={() => setAnimation("none")}
      className={`grid rounded-lg transition-[grid-template-rows,opacity] duration-200 ease-in motion-reduce:transition-none ${
        isLeaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
      } ${ROW_ANIMATIONS[animation]}`}
    >
      <div className={`min-h-0 ${isLeaving || isEntering ? "overflow-hidden" : ""}`}>
        <div className="flex items-center gap-3 py-3">
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(event) => toggleCompleted(event.target.checked)}
            aria-label={`Mark "${task.title}" as ${isCompleted ? "not done" : "done"}`}
            className="size-5 shrink-0 cursor-pointer accent-brand-600 transition-transform motion-safe:checked:scale-110"
          />
          <span
            className={`min-w-0 flex-1 break-words transition-colors duration-300 ${isCompleted ? "text-gray-400 line-through" : ""}`}
          >
            {task.title}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={`Edit "${task.title}"`}
            className={ICON_BUTTON}
          >
            <Pencil className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => leaveThen(() => deleteTask.mutate())}
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

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

function pickRowState(isLeaving: boolean, isEntering: boolean): "leaving" | "entering" | undefined {
  if (isLeaving) {
    return "leaving"
  }

  return isEntering ? "entering" : undefined
}
