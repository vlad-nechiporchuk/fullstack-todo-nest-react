interface NoticeProps {
  message: string
  onDismiss: () => void
}

export function Notice({ message, onDismiss }: NoticeProps) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
    >
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="font-medium underline underline-offset-2">
        Dismiss
      </button>
    </div>
  )
}
