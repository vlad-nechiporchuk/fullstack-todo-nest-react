import type { Problem, Task, TaskCounts, TaskPage } from "@workspace/common"
import request from "supertest"
import type TestAgent from "supertest/lib/agent"
import type { DataSource } from "typeorm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestApp, resetTables, type TestApp } from "../../support/create-test-app"

const TASKS = "/api/v1/tasks"
const MISSING_ID = "4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const PROBLEM_JSON = "application/problem+json; charset=utf-8"
const PROBLEMS = "https://todo.example/problems"

describe("/api/v1/tasks", () => {
  let testApp: TestApp
  let api: TestAgent

  beforeAll(async () => {
    testApp = await createTestApp()
    api = request(testApp.app.getHttpServer())
  })

  afterAll(() => testApp.close())

  beforeEach(() => resetTables(testApp.dataSource, "tasks"))

  async function createTask(title: string): Promise<Task> {
    const response = await api.post(TASKS).send({ title }).expect(201)
    return response.body
  }

  async function readTask(id: string): Promise<Task> {
    const response = await api.get(`${TASKS}/${id}`).expect(200)
    return response.body
  }

  describe("POST", () => {
    // createTaskSchema has no optional fields, so one happy path covers the full and the minimum payload.
    it("should create an open task with a trimmed title, its location and its version as ETag", async () => {
      const response = await api.post(TASKS).send({ title: "  Buy milk  " }).expect(201)

      expect(response.body.id).toMatch(UUID)
      expect(response.body).toEqual({
        id: response.body.id,
        title: "Buy milk",
        completed: false,
        completedAt: null,
        createdAt: response.body.createdAt,
        updatedAt: response.body.createdAt,
        version: 1,
      })
      expectRecent(response.body.createdAt)
      expect(response.headers.location).toBe(`${TASKS}/${response.body.id}`)
      expect(response.headers.etag).toBe('"1"')
      expect(await readTask(response.body.id)).toEqual(response.body)
    })

    it("should accept the title when it is exactly 200 characters", async () => {
      const title = "a".repeat(200)

      const response = await api.post(TASKS).send({ title }).expect(201)

      expect(response.body).toEqual({
        id: response.body.id,
        title,
        completed: false,
        completedAt: null,
        createdAt: response.body.createdAt,
        updatedAt: response.body.createdAt,
        version: 1,
      })
      expect(await readTask(response.body.id)).toEqual(response.body)
    })

    it.each([
      ["201 characters", "a".repeat(201), "Title must be at most 200 characters"],
      ["only whitespace", "   ", "Title must not be empty"],
    ])("should reject the title when it is %s", async (_case, title, message) => {
      const response = await api.post(TASKS).send({ title }).expect(400)

      expectProblem(response, buildExpectedValidationProblem(TASKS, [{ path: "title", message }]))
    })

    it("should reject a field the client may not set", async () => {
      const response = await api.post(TASKS).send({ title: "x", completed: true }).expect(400)

      expectProblem(
        response,
        buildExpectedValidationProblem(TASKS, [{ path: "(root)", message: 'Unrecognized key: "completed"' }]),
      )
    })

    it("should answer a malformed JSON body with a 400 problem", async () => {
      const response = await api.post(TASKS).set("content-type", "application/json").send('{"title":').expect(400)

      expectProblem(response, {
        type: `${PROBLEMS}/validation-error`,
        title: "Malformed JSON body",
        status: 400,
        detail: "The request body is not valid JSON",
        instance: TASKS,
      })
    })
  })

  describe("GET when there are no tasks", () => {
    it("should return an empty page with every count at zero", async () => {
      const response = await api.get(TASKS).expect(200)

      expect(response.body).toEqual({
        items: [],
        total: 0,
        limit: 50,
        offset: 0,
        counts: { all: 0, active: 0, completed: 0 },
      })
    })
  })

  describe("GET", () => {
    const counts: TaskCounts = { all: 3, active: 2, completed: 1 }
    let first: Task
    let second: Task
    let third: Task

    beforeEach(async () => {
      first = await createTask("first")
      const created = await createTask("second")
      third = await createTask("third")
      second = (await api.patch(`${TASKS}/${created.id}`).send({ completed: true }).expect(200)).body
    })

    it("should list every task newest first with the default paging", async () => {
      const response = await api.get(TASKS).expect(200)

      const expected: TaskPage = { items: [third, second, first], total: 3, limit: 50, offset: 0, counts }
      expect(response.body).toEqual(expected)
    })

    it.each([
      ["active", () => [third, first]],
      ["completed", () => [second]],
    ])("should list only %s tasks when filtered by status", async (status, getItems) => {
      const items = getItems()

      const response = await api.get(TASKS).query({ status }).expect(200)

      expect(response.body).toEqual({ items, total: items.length, limit: 50, offset: 0, counts })
    })

    it("should return the requested slice when given limit and offset", async () => {
      const response = await api.get(TASKS).query({ limit: 2, offset: 2 }).expect(200)

      expect(response.body).toEqual({ items: [first], total: 3, limit: 2, offset: 2, counts })
    })

    it("should apply every list option when status, limit and offset are all given", async () => {
      const response = await api.get(TASKS).query({ status: "active", limit: 1, offset: 1 }).expect(200)

      expect(response.body).toEqual({ items: [first], total: 2, limit: 1, offset: 1, counts })
    })

    it("should return an empty page when the offset is past the end", async () => {
      const response = await api.get(TASKS).query({ offset: 10 }).expect(200)

      expect(response.body).toEqual({ items: [], total: 3, limit: 50, offset: 10, counts })
    })

    it("should reject the query when the status is unknown", async () => {
      const response = await api.get(TASKS).query({ status: "done" }).expect(400)

      expectProblem(
        response,
        buildExpectedValidationProblem(`${TASKS}?status=done`, [
          { path: "status", message: 'Invalid option: expected one of "all"|"active"|"completed"' },
        ]),
      )
    })

    it("should reject the query when the limit is out of range", async () => {
      const response = await api.get(TASKS).query({ limit: 0 }).expect(400)

      expectProblem(
        response,
        buildExpectedValidationProblem(`${TASKS}?limit=0`, [
          { path: "limit", message: "Too small: expected number to be >=1" },
        ]),
      )
    })
  })

  describe("GET /:id", () => {
    it("should return the task with its version as ETag", async () => {
      const task = await createTask("Buy milk")

      const response = await api.get(`${TASKS}/${task.id}`).expect(200)

      expect(response.body).toEqual(task)
      expect(response.headers.etag).toBe('"1"')
    })

    it("should answer 400 when the id is not a UUID", async () => {
      const response = await api.get(`${TASKS}/abc`).expect(400)

      expectProblem(response, {
        type: `${PROBLEMS}/validation-error`,
        title: "Invalid id",
        status: 400,
        detail: "An id is a UUID",
        instance: `${TASKS}/abc`,
      })
    })

    it.each([
      ["a version 4 UUID", MISSING_ID],
      ["a UUID of another version", "01890a5d-ac96-774b-bcce-b302099a8057"],
    ])("should answer 404 when the id is %s no task has", async (_case, id) => {
      const response = await api.get(`${TASKS}/${id}`).expect(404)

      expectProblem(response, buildExpectedNotFoundProblem(id))
    })
  })

  describe("PATCH /:id", () => {
    it("should change every field and bump the version when given the full payload", async () => {
      const before = await createTask("Buy milk")

      const response = await api.patch(`${TASKS}/${before.id}`).send({ title: "Buy oat milk", completed: true })

      expect(response.status).toBe(200)
      const after = await readTask(before.id)
      expect(after).toEqual({
        ...before,
        title: "Buy oat milk",
        completed: true,
        completedAt: after.completedAt,
        updatedAt: after.updatedAt,
        version: before.version + 1,
      })
      expectRecent(after.completedAt)
      expectUpdatedAfter(after, before)
      expect(response.body).toEqual(after)
      expect(response.headers.etag).toBe('"2"')
    })

    it("should change only the given field when given the minimum payload", async () => {
      const before = await createTask("Buy milk")

      const response = await api.patch(`${TASKS}/${before.id}`).send({ title: "Buy oat milk" }).expect(200)

      const after = await readTask(before.id)
      expect(after).toEqual({ ...before, title: "Buy oat milk", updatedAt: after.updatedAt, version: 2 })
      expectUpdatedAfter(after, before)
      expect(response.body).toEqual(after)
    })

    it("should keep the original completion time when a completed task is completed again", async () => {
      const task = await createTask("Buy milk")
      const completed: Task = (await api.patch(`${TASKS}/${task.id}`).send({ completed: true }).expect(200)).body

      const response = await api.patch(`${TASKS}/${task.id}`).send({ completed: true }).expect(200)

      const after = await readTask(task.id)
      expect(after).toEqual({ ...completed, updatedAt: after.updatedAt, version: 3 })
      expectUpdatedAfter(after, completed)
      expect(response.body).toEqual(after)
    })

    it("should clear the completion time when a task is reopened", async () => {
      const task = await createTask("Buy milk")
      const completed: Task = (await api.patch(`${TASKS}/${task.id}`).send({ completed: true }).expect(200)).body

      const response = await api.patch(`${TASKS}/${task.id}`).send({ completed: false }).expect(200)

      const after = await readTask(task.id)
      expect(after).toEqual({ ...task, updatedAt: after.updatedAt, version: 3 })
      expectUpdatedAfter(after, completed)
      expect(response.body).toEqual(after)
    })

    it("should apply the change when If-Match carries the current version", async () => {
      const task = await createTask("Buy milk")

      const response = await api
        .patch(`${TASKS}/${task.id}`)
        .set("If-Match", '"1"')
        .send({ title: "Buy oat milk" })
        .expect(200)

      const after = await readTask(task.id)
      expect(after).toEqual({ ...task, title: "Buy oat milk", updatedAt: after.updatedAt, version: 2 })
      expectUpdatedAfter(after, task)
      expect(response.body).toEqual(after)
    })

    it("should refuse the change with 412 and keep the row when If-Match is stale", async () => {
      const task = await createTask("Buy milk")
      await api.patch(`${TASKS}/${task.id}`).set("If-Match", '"1"').send({ title: "v2" }).expect(200)
      const current = await readTask(task.id)

      const response = await api.patch(`${TASKS}/${task.id}`).set("If-Match", '"1"').send({ title: "v3" }).expect(412)

      expectProblem(response, {
        type: `${PROBLEMS}/version-mismatch`,
        title: "Version mismatch",
        status: 412,
        detail: `Task ${task.id} is at version 2, but If-Match expected 1. Re-fetch it and retry.`,
        instance: `${TASKS}/${task.id}`,
      })
      expect(await readTask(task.id)).toEqual(current)
    })

    it("should let exactly one of two concurrent updates with the same If-Match win", async () => {
      const task = await createTask("Buy milk")

      const responses = await Promise.all(
        ["from tab A", "from tab B"].map((title) =>
          api.patch(`${TASKS}/${task.id}`).set("If-Match", '"1"').send({ title }),
        ),
      )

      expect(responses.map((response) => response.status).sort()).toEqual([200, 412])
      const winner = responses.find((response) => response.status === 200)
      expect(await readTask(task.id)).toEqual(winner?.body)
    })

    it("should refuse an update with 412 when another writer changes the task while the update waits", async () => {
      const task = await createTask("Buy milk")
      const otherWriter = testApp.dataSource.createQueryRunner()
      await otherWriter.connect()
      await otherWriter.startTransaction()
      await otherWriter.query(`UPDATE tasks SET title = 'from tab B', version = version + 1 WHERE id = $1`, [task.id])

      const pending = api.patch(`${TASKS}/${task.id}`).set("If-Match", '"1"').send({ title: "from tab A" }).then()
      await expect
        .poll(() => countRequestsWaitingForLock(testApp.dataSource), { message: "waiting for the update to block" })
        .toBe(1)
      await otherWriter.commitTransaction()
      await otherWriter.release()
      const response = await pending

      expect(response.status).toBe(412)
      expectProblem(response, {
        type: `${PROBLEMS}/version-mismatch`,
        title: "Version mismatch",
        status: 412,
        detail: `Task ${task.id} is at version 2, but If-Match expected 1. Re-fetch it and retry.`,
        instance: `${TASKS}/${task.id}`,
      })
      expect(await readTask(task.id)).toEqual({ ...task, title: "from tab B", version: 2 })
    })

    it("should treat If-Match: * as no precondition", async () => {
      const task = await createTask("Buy milk")

      const response = await api.patch(`${TASKS}/${task.id}`).set("If-Match", "*").send({ completed: true }).expect(200)

      const after = await readTask(task.id)
      expect(after).toEqual({
        ...task,
        completed: true,
        completedAt: after.completedAt,
        updatedAt: after.updatedAt,
        version: 2,
      })
      expectRecent(after.completedAt)
      expectUpdatedAfter(after, task)
      expect(response.body).toEqual(after)
    })

    it.each([
      ["not a quoted ETag", "1"],
      ["a version beyond what the database holds", '"2147483648"'],
    ])("should reject an If-Match header that is %s", async (_case, ifMatch) => {
      const task = await createTask("Buy milk")

      const response = await api
        .patch(`${TASKS}/${task.id}`)
        .set("If-Match", ifMatch)
        .send({ completed: true })
        .expect(400)

      expectProblem(response, {
        type: `${PROBLEMS}/validation-error`,
        title: "Invalid If-Match header",
        status: 400,
        detail: `If-Match must be an ETag such as "3", got: ${ifMatch}`,
        instance: `${TASKS}/${task.id}`,
      })
      expect(await readTask(task.id)).toEqual(task)
    })

    it.each([
      ["201 characters", "a".repeat(201), "Title must be at most 200 characters"],
      ["only whitespace", "   ", "Title must not be empty"],
    ])("should reject the new title and keep the row when it is %s", async (_case, title, message) => {
      const task = await createTask("Buy milk")

      const response = await api.patch(`${TASKS}/${task.id}`).send({ title }).expect(400)

      expectProblem(response, buildExpectedValidationProblem(`${TASKS}/${task.id}`, [{ path: "title", message }]))
      expect(await readTask(task.id)).toEqual(task)
    })

    it("should reject the patch when it sets no field", async () => {
      const task = await createTask("Buy milk")

      const response = await api.patch(`${TASKS}/${task.id}`).send({}).expect(400)

      expectProblem(
        response,
        buildExpectedValidationProblem(`${TASKS}/${task.id}`, [
          { path: "(root)", message: "Provide at least one of: title, completed" },
        ]),
      )
    })

    it("should answer 404 when the task does not exist", async () => {
      const response = await api.patch(`${TASKS}/${MISSING_ID}`).send({ completed: true }).expect(404)

      expectProblem(response, buildExpectedNotFoundProblem(MISSING_ID))
    })
  })

  describe("tasks table", () => {
    it.each([
      ["a blank title", "   ", false, null, "chk_tasks_title_not_blank"],
      ["a completed task without a completion time", "Buy milk", true, null, "chk_tasks_completed_at"],
      ["an open task with a completion time", "Buy milk", false, new Date(), "chk_tasks_completed_at"],
    ])("should refuse %s written past the API", async (_case, title, completed, completedAt, constraint) => {
      const insert = testApp.dataSource.query(
        "INSERT INTO tasks (title, completed, completed_at, version) VALUES ($1, $2, $3, 1)",
        [title, completed, completedAt],
      )

      await expect(insert).rejects.toMatchObject({ code: "23514", constraint })
    })
  })

  describe("DELETE /:id", () => {
    it("should delete the task so that it can no longer be read", async () => {
      const task = await createTask("Buy milk")

      const response = await api.delete(`${TASKS}/${task.id}`).expect(204)

      expect(response.body).toEqual({})
      expectProblem(await api.get(`${TASKS}/${task.id}`).expect(404), buildExpectedNotFoundProblem(task.id))
    })

    it("should answer 404 when the task does not exist", async () => {
      const response = await api.delete(`${TASKS}/${MISSING_ID}`).expect(404)

      expectProblem(response, buildExpectedNotFoundProblem(MISSING_ID))
    })
  })
})

async function countRequestsWaitingForLock(dataSource: DataSource): Promise<number> {
  const rows: { waiting: number }[] = await dataSource.query(
    `SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  )
  return rows[0]?.waiting ?? 0
}

function expectProblem(response: request.Response, expected: Problem): void {
  expect(response.headers["content-type"]).toBe(PROBLEM_JSON)
  expect(response.body).toEqual(expected)
}

function expectRecent(timestamp: string | null): void {
  expect(timestamp).toEqual(expect.any(String))
  expect(Math.abs(Date.now() - Date.parse(timestamp ?? ""))).toBeLessThan(10_000)
}

function expectUpdatedAfter(after: Task, before: Task): void {
  expectRecent(after.updatedAt)
  expect(Date.parse(after.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt))
}

function buildExpectedValidationProblem(instance: string, errors: Problem["errors"]): Problem {
  return {
    type: `${PROBLEMS}/validation-error`,
    title: "Validation failed",
    status: 400,
    detail: "The request does not match the expected schema",
    errors,
    instance,
  }
}

function buildExpectedNotFoundProblem(id: string): Problem {
  return {
    type: `${PROBLEMS}/not-found`,
    title: "Resource not found",
    status: 404,
    detail: `Task ${id} does not exist`,
    instance: `${TASKS}/${id}`,
  }
}
