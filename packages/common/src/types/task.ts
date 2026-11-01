import type { z } from "zod"
import type {
  createTaskSchema,
  listTasksQuerySchema,
  taskCountsSchema,
  taskPageSchema,
  taskSchema,
  taskStatusFilterSchema,
  updateTaskSchema,
} from "../schemas/task"

export type Task = z.infer<typeof taskSchema>
export type TaskPage = z.infer<typeof taskPageSchema>
export type TaskCounts = z.infer<typeof taskCountsSchema>
export type TaskStatusFilter = z.infer<typeof taskStatusFilterSchema>
export type CreateTask = z.infer<typeof createTaskSchema>
export type UpdateTask = z.infer<typeof updateTaskSchema>
export type ListTasksQuery = z.input<typeof listTasksQuerySchema>
export type ListTasksParams = z.output<typeof listTasksQuerySchema>
