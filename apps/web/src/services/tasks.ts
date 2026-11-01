import {
  type CreateTask,
  type ListTasksQuery,
  type Task,
  type TaskPage,
  taskPageSchema,
  taskSchema,
  type UpdateTask,
} from "@workspace/common"
import { requestJson, requestNoContent } from "../lib/api-client"

export function listTasks(query: ListTasksQuery = {}): Promise<TaskPage> {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(name, String(value))
    }
  }
  const search = params.size > 0 ? `?${params}` : ""

  return requestJson(`/tasks${search}`, taskPageSchema)
}

export function createTask(input: CreateTask): Promise<Task> {
  return requestJson("/tasks", taskSchema, { method: "POST", body: input })
}

/** Changes a task only while it is still at `version`, the one the caller last saw; otherwise the API answers 412. */
export function updateTask(id: string, patch: UpdateTask, version: number): Promise<Task> {
  return requestJson(`/tasks/${encodeURIComponent(id)}`, taskSchema, {
    method: "PATCH",
    body: patch,
    headers: { "If-Match": `"${version}"` },
  })
}

export function deleteTask(id: string): Promise<void> {
  return requestNoContent(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })
}
