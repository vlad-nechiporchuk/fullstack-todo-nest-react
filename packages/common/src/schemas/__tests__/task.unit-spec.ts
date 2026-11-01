import { describe, expect, it } from "vitest"
import type { z } from "zod"
import { createTaskSchema, listTasksQuerySchema, TASK_TITLE_MAX_LENGTH, updateTaskSchema } from "../task"

interface IssueSummary {
  path: string
  code: string
  message: string
}

function getIssues(schema: z.ZodType, input: unknown): IssueSummary[] {
  const result = schema.safeParse(input)
  expect(result.success, "expected the input to be rejected").toBe(false)

  return (result.error?.issues ?? []).map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }))
}

describe("createTaskSchema", () => {
  it("should trim the title", () => {
    expect(createTaskSchema.parse({ title: "  Buy milk  " })).toEqual({ title: "Buy milk" })
  })

  it("should accept a title when it is exactly the maximum length", () => {
    const title = "a".repeat(TASK_TITLE_MAX_LENGTH)

    expect(createTaskSchema.parse({ title })).toEqual({ title })
  })

  it("should reject the title when it is only whitespace", () => {
    expect(getIssues(createTaskSchema, { title: "   " })).toEqual([
      { path: "title", code: "too_small", message: "Title must not be empty" },
    ])
  })

  it("should reject the title when it is one character over the maximum", () => {
    expect(getIssues(createTaskSchema, { title: "a".repeat(TASK_TITLE_MAX_LENGTH + 1) })).toEqual([
      { path: "title", code: "too_big", message: "Title must be at most 200 characters" },
    ])
  })

  it("should reject a field the client may not set", () => {
    expect(getIssues(createTaskSchema, { title: "x", completed: true })).toEqual([
      { path: "", code: "unrecognized_keys", message: 'Unrecognized key: "completed"' },
    ])
  })
})

describe("updateTaskSchema", () => {
  it("should accept a patch when it sets only some fields", () => {
    expect(updateTaskSchema.parse({ completed: true })).toEqual({ completed: true })
  })

  it("should reject the patch when it sets no field", () => {
    expect(getIssues(updateTaskSchema, {})).toEqual([
      { path: "", code: "custom", message: "Provide at least one of: title, completed" },
    ])
  })
})

describe("listTasksQuerySchema", () => {
  it("should apply defaults and coerce numbers when given query-string values", () => {
    expect(listTasksQuerySchema.parse({ limit: "10" })).toEqual({ status: "all", limit: 10, offset: 0 })
  })

  it.each([
    ["0", "too_small"],
    ["1000", "too_big"],
  ])("should reject limit=%s", (limit, code) => {
    expect(getIssues(listTasksQuerySchema, { limit }).map(({ path, code }) => ({ path, code }))).toEqual([
      { path: "limit", code },
    ])
  })
})
