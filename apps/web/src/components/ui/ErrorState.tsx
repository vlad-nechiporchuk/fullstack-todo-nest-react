interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-white px-3 py-1.5 font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  )
}
