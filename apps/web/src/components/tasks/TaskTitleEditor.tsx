import { createTaskSchema } from "@workspace/common"
import { Check, X } from "lucide-react"
import { type KeyboardEvent, useId, useState } from "react"

interface TaskTitleEditorProps {
  title: string
  isSaving: boolean
  onSave: (title: string) => void
  onCancel: () => void
}

export function TaskTitleEditor({ title, isSaving, onSave, onCancel }: TaskTitleEditorProps) {
  const [draft, setDraft] = useState(title)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  function saveDraft(): void {
    if (isSaving) {
      return
    }

    const parsed = createTaskSchema.shape.title.safeParse(draft)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }

    onSave(parsed.data)
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      saveDraft()
    } else if (event.key === "Escape" && !isSaving) {
      onCancel()
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-5 shrink-0" aria-hidden="true" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          readOnly={isSaving}
          // biome-ignore lint/a11y/noAutofocus: the field appears because the person asked to edit this task.
          autoFocus
          aria-label={`New title for "${title}"`}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="h-10 min-w-0 flex-1 rounded-lg border border-brand-600 px-3 outline-none ring-2 ring-brand-100 aria-invalid:border-red-500"
        />
        <button
          type="button"
          onClick={saveDraft}
          disabled={isSaving}
          aria-label="Save title"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <Check className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Cancel editing"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 pl-8 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
