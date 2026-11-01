import { Check } from "lucide-react"
import { TaskBoard } from "./components/tasks/TaskBoard"

export function App() {
  return (
    <div className="min-h-dvh px-3 py-10 sm:px-4 sm:py-16">
      <header className="mb-8 flex items-center justify-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">
          <Check className="size-5" strokeWidth={3} />
        </span>
        <span className="text-2xl font-bold tracking-tight">taskly</span>
      </header>

      <main className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-10">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">My tasks</h1>
        <p className="mt-2 text-gray-500">Clear your mind. One task at a time.</p>
        <TaskBoard />
      </main>
    </div>
  )
}
