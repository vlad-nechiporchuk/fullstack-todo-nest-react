import { type Problem, taskSchema } from "@workspace/common"
import { HttpResponse, http } from "msw"
import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import { server } from "../../test/msw-server"
import { ApiError, requestJson, requestNoContent } from "../api-client"

const TASK_URL = "http://localhost:3000/api/v1/tasks/4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a"
const TASK = {
  id: "4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a",
  title: "Buy milk",
  completed: false,
  completedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  version: 1,
}

describe("requestJson", () => {
  it("should return the body parsed by the contract schema when the API answers 2xx", async () => {
    server.use(http.get(TASK_URL, () => HttpResponse.json(TASK)))

    await expect(requestJson(`/tasks/${TASK.id}`, taskSchema)).resolves.toEqual(TASK)
  })

  it("should reject with the problem body when the API answers with a problem", async () => {
    const problem: Problem = {
      type: "https://todo.example/problems/not-found",
      title: "Resource not found",
      status: 404,
      detail: `Task ${TASK.id} does not exist`,
      instance: `/api/v1/tasks/${TASK.id}`,
    }
    server.use(
      http.get(TASK_URL, () =>
        HttpResponse.json(problem, { status: 404, headers: { "Content-Type": "application/problem+json" } }),
      ),
    )

    const error = await requestJson(`/tasks/${TASK.id}`, taskSchema).catch((caught: unknown) => caught)

    expect(error).toEqual(new ApiError(problem))
    expect((error as ApiError).status).toBe(404)
  })

  it("should reject with a problem built from the status when an error has no problem body", async () => {
    server.use(
      http.get(
        TASK_URL,
        () => new HttpResponse("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
      ),
    )

    const error = await requestJson(`/tasks/${TASK.id}`, taskSchema).catch((caught: unknown) => caught)

    expect(error).toEqual(new ApiError({ type: "about:blank", title: "Bad Gateway", status: 502 }))
  })

  it("should reject when the response breaks the contract", async () => {
    server.use(http.get(TASK_URL, () => HttpResponse.json({ ...TASK, version: "one" })))

    await expect(requestJson(`/tasks/${TASK.id}`, taskSchema)).rejects.toBeInstanceOf(ZodError)
  })
})

describe("requestNoContent", () => {
  it("should resolve when the API answers 204", async () => {
    server.use(http.delete(TASK_URL, () => new HttpResponse(null, { status: 204 })))

    await expect(requestNoContent(`/tasks/${TASK.id}`, { method: "DELETE" })).resolves.toBeUndefined()
  })
})
