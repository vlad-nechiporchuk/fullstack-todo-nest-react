import type { Task, TaskPage } from "@workspace/common"
import { HttpResponse, http } from "msw"
import { describe, expect, it } from "vitest"
import { server } from "../../test/msw-server"
import { createTask, deleteTask, listTasks, updateTask } from "../tasks"

const TASKS_URL = "http://localhost:3000/api/v1/tasks"
const TASK: Task = {
  id: "4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a",
  title: "Buy milk",
  completed: false,
  completedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  version: 1,
}

interface CapturedRequest {
  method: string
  url: string
  ifMatch: string | null
  body: unknown
}

describe("tasks service", () => {
  it("should list tasks with only the query parameters it was given", async () => {
    const page: TaskPage = {
      items: [TASK],
      total: 1,
      limit: 10,
      offset: 0,
      counts: { all: 1, active: 1, completed: 0 },
    }
    const requests = captureRequests(http.get(TASKS_URL, () => HttpResponse.json(page)))

    await expect(listTasks({ status: "active", limit: 10 })).resolves.toEqual(page)

    expect(requests).toEqual([{ method: "GET", url: `${TASKS_URL}?status=active&limit=10`, ifMatch: null, body: null }])
  })

  it("should create a task by posting its title", async () => {
    const requests = captureRequests(http.post(TASKS_URL, () => HttpResponse.json(TASK, { status: 201 })))

    await expect(createTask({ title: "Buy milk" })).resolves.toEqual(TASK)

    expect(requests).toEqual([{ method: "POST", url: TASKS_URL, ifMatch: null, body: { title: "Buy milk" } }])
  })

  it("should update a task with the version it last saw as If-Match", async () => {
    const updated: Task = { ...TASK, completed: true, completedAt: "2026-11-01T11:00:00.000Z", version: 2 }
    const requests = captureRequests(http.patch(`${TASKS_URL}/${TASK.id}`, () => HttpResponse.json(updated)))

    await expect(updateTask(TASK.id, { completed: true }, 1)).resolves.toEqual(updated)

    expect(requests).toEqual([
      { method: "PATCH", url: `${TASKS_URL}/${TASK.id}`, ifMatch: '"1"', body: { completed: true } },
    ])
  })

  it("should delete a task by its id", async () => {
    const requests = captureRequests(
      http.delete(`${TASKS_URL}/${TASK.id}`, () => new HttpResponse(null, { status: 204 })),
    )

    await expect(deleteTask(TASK.id)).resolves.toBeUndefined()

    expect(requests).toEqual([{ method: "DELETE", url: `${TASKS_URL}/${TASK.id}`, ifMatch: null, body: null }])
  })
})

function captureRequests(handler: ReturnType<typeof http.get>): CapturedRequest[] {
  const requests: CapturedRequest[] = []
  server.events.on("request:start", async ({ request }) => {
    const text = await request.clone().text()
    requests.push({
      method: request.method,
      url: request.url,
      ifMatch: request.headers.get("If-Match"),
      body: text ? JSON.parse(text) : null,
    })
  })
  server.use(handler)

  return requests
}
