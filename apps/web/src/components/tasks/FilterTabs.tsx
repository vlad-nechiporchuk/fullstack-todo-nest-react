import type { TaskCounts, TaskStatusFilter } from "@workspace/common"

const FILTERS = [
  { status: "all", label: "All" },
  { status: "active", label: "Active" },
  { status: "completed", label: "Completed" },
] as const satisfies readonly { status: TaskStatusFilter; label: string }[]

interface FilterTabsProps {
  status: TaskStatusFilter
  counts: TaskCounts | undefined
  onStatusChange: (status: TaskStatusFilter) => void
}

export function FilterTabs({ status, counts, onStatusChange }: FilterTabsProps) {
  return (
    <fieldset className="mt-8 flex min-w-0 border-0 border-b border-gray-200 p-0 sm:gap-1">
      <legend className="sr-only">Filter tasks</legend>
      {FILTERS.map((filter) => {
        const isSelected = filter.status === status

        return (
          <button
            key={filter.status}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onStatusChange(filter.status)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-1.5 py-3 text-sm font-medium sm:gap-2 sm:px-3 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
              isSelected ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {filter.label}
            <span
              className={`rounded-md px-1 py-0.5 text-xs tabular-nums sm:px-2 ${isSelected ? "bg-brand-50 text-brand-600" : "bg-gray-100 text-gray-500"}`}
            >
              {counts?.[filter.status] ?? "–"}
            </span>
          </button>
        )
      })}
    </fieldset>
  )
}
