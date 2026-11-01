const ROWS = [0, 1, 2]

export function TaskListSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-gray-100">
      <span className="sr-only">Loading tasks…</span>
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-3 py-4" aria-hidden="true">
          <span className="size-5 rounded bg-gray-100" />
          <span className="h-4 flex-1 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}
