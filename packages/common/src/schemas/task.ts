import { z } from "zod"

export const TASK_TITLE_MAX_LENGTH = 200

export const LIST_LIMIT_DEFAULT = 50
export const LIST_LIMIT_MAX = 100

const title = z
  .string()
  .trim()
  .min(1, "Title must not be empty")
  .max(TASK_TITLE_MAX_LENGTH, `Title must be at most ${TASK_TITLE_MAX_LENGTH} characters`)

export const taskStatusFilterSchema = z.enum(["all", "active", "completed"])

export const taskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  completed: z.boolean(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.int().positive().describe("Increments on every change; send it back in If-Match to update safely"),
})

export const createTaskSchema = z.strictObject({
  title,
})

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    completed: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.completed !== undefined, {
    message: "Provide at least one of: title, completed",
  })

export const listTasksQuerySchema = z.object({
  status: taskStatusFilterSchema.default("all"),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).default(0),
})

export const taskCountsSchema = z
  .object({
    all: z.int().nonnegative(),
    active: z.int().nonnegative(),
    completed: z.int().nonnegative(),
  })
  .describe("How many tasks each status filter holds, whatever filter the page itself uses")

export const taskPageSchema = z.object({
  items: z.array(taskSchema),
  total: z.int().nonnegative(),
  limit: z.int().positive(),
  offset: z.int().nonnegative(),
  counts: taskCountsSchema,
})
