import { createTaskSchema, type Task } from "@workspace/common"
import { Plus } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { useCreateTask } from "../../hooks/use-tasks"
import { describeError } from "../../lib/error-message"

interface TaskComposerProps {
  onCreated: (task: Task) => void
}

export function TaskComposer({ onCreated }: TaskComposerProps) {
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const createTask = useCreateTask()
  const errorId = useId()

  function submitTask(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const parsed = createTaskSchema.safeParse({ title })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }

    setError(null)
    const submitted = title
    createTask.mutate(parsed.data.title, {
      onSuccess: (task) => {
        setTitle((current) => (current === submitted ? "" : current))
        onCreated(task)
      },
      onError: (failure) => setError(describeError(failure)),
    })
  }

  return (
    <form onSubmit={submitTask} noValidate className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to be done?"
          aria-label="New task"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full rounded-lg border border-gray-300 px-4 text-base outline-none transition-colors placeholder:text-gray-400 sm:flex-1 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500"
        />
        <button
          type="submit"
          disabled={createTask.isPending}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <Plus className="size-5" aria-hidden="true" />
          Add task
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
