import {
  createTaskSchema,
  listTasksQuerySchema,
  type Problem,
  type Task,
  type TaskPage,
  updateTaskSchema,
} from "@workspace/common"
import { HttpResponse, http } from "msw"
import type { ZodError } from "zod"
import { server } from "./msw-server"

const TASKS_URL = "http://localhost:3000/api/v1/tasks"

export interface FakeTasksApi {
  tasks: Task[]
  requests: { method: string; url: string; ifMatch: string | null; body: unknown }[]
  /** Holds the next request with this method in flight until the returned function is called. */
  holdNext: (method: "GET" | "POST" | "PATCH" | "DELETE") => () => void
}

/**
 * An in-memory tasks API with the real API's rules that matter to the UI: versions, If-Match and 412, counts per
 * status, and validation by the shared contract.
 */
export function installFakeTasksApi(initialTasks: Task[] = []): FakeTasksApi {
  let created = 0
  const held = new Map<string, Promise<void>>()
  const api: FakeTasksApi = {
    tasks: initialTasks.map((task) => ({ ...task })),
    requests: [],
    holdNext: (method) => {
      let release = () => {}
      held.set(
        method,
        new Promise((resolve) => {
          release = resolve
        }),
      )

      return () => release()
    },
  }

  server.events.on("request:start", async ({ request }) => {
    const text = await request.clone().text()
    api.requests.push({
      method: request.method,
      url: request.url,
      ifMatch: request.headers.get("If-Match"),
      body: text ? JSON.parse(text) : null,
    })
  })

  server.use(
    http.get(TASKS_URL, async ({ request }) => {
      await takeHold(held, "GET")
      const query = listTasksQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
      const matching = api.tasks.filter(
        (task) => query.status === "all" || task.completed === (query.status === "completed"),
      )
      const active = api.tasks.filter((task) => !task.completed).length
      const page: TaskPage = {
        items: matching.slice(query.offset, query.offset + query.limit),
        total: matching.length,
        limit: query.limit,
        offset: query.offset,
        counts: { all: api.tasks.length, active, completed: api.tasks.length - active },
      }

      return HttpResponse.json(page)
    }),

    http.post(TASKS_URL, async ({ request }) => {
      await takeHold(held, "POST")
      const parsed = createTaskSchema.safeParse(await request.json())
      if (!parsed.success) {
        return validationProblem(parsed.error, "/api/v1/tasks")
      }

      created += 1
      const now = new Date().toISOString()
      const task: Task = {
        id: `00000000-0000-4000-8000-${String(created).padStart(12, "0")}`,
        title: parsed.data.title,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      }
      api.tasks.unshift(task)

      return HttpResponse.json(task, { status: 201 })
    }),

    http.patch(`${TASKS_URL}/:id`, async ({ request, params }) => {
      await takeHold(held, "PATCH")

      const task = api.tasks.find((candidate) => candidate.id === params.id)
      if (!task) {
        return problem({ type: "about:blank", title: "Not Found", status: 404 })
      }

      const expected = request.headers.get("If-Match")
      if (expected && expected !== `"${task.version}"`) {
        return problem({
          type: "https://todo.example/problems/version-mismatch",
          title: "Version mismatch",
          status: 412,
        })
      }

      const parsed = updateTaskSchema.safeParse(await request.json())
      if (!parsed.success) {
        return validationProblem(parsed.error, `/api/v1/tasks/${task.id}`)
      }

      Object.assign(task, parsed.data, {
        completedAt:
          parsed.data.completed === undefined
            ? task.completedAt
            : parsed.data.completed
              ? (task.completedAt ?? new Date().toISOString())
              : null,
        updatedAt: new Date().toISOString(),
        version: task.version + 1,
      })

      return HttpResponse.json(task)
    }),

    http.delete(`${TASKS_URL}/:id`, async ({ params }) => {
      await takeHold(held, "DELETE")
      const index = api.tasks.findIndex((candidate) => candidate.id === params.id)
      if (index === -1) {
        return problem({ type: "about:blank", title: "Not Found", status: 404 })
      }

      api.tasks.splice(index, 1)

      return new HttpResponse(null, { status: 204 })
    }),
  )

  return api
}

export function buildTask(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  return {
    completed: false,
    completedAt: null,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    version: 1,
    ...overrides,
  }
}

async function takeHold(held: Map<string, Promise<void>>, method: string): Promise<void> {
  const hold = held.get(method)
  held.delete(method)
  await hold
}

function problem(body: Problem) {
  return HttpResponse.json(body, { status: body.status, headers: { "Content-Type": "application/problem+json" } })
}

function validationProblem(error: ZodError, instance: string) {
  return problem({
    type: "https://todo.example/problems/validation-error",
    title: "Validation failed",
    status: 400,
    errors: error.issues.map((issue) => ({ path: issue.path.join(".") || "(root)", message: issue.message })),
    instance,
  })
}
