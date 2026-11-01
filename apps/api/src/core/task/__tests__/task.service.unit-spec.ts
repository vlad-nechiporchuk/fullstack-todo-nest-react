import type { Task } from "@workspace/common"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ResourceNotFoundException, VersionMismatchException } from "../../../common/errors/domain-errors"
import { TaskEntity } from "../entities/task.entity"
import type { TaskDao } from "../task.dao"
import { TaskService } from "../task.service"

const ID = "4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a"
const TASK: Task = {
  id: ID,
  title: "Buy milk",
  completed: false,
  completedAt: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  version: 1,
}

describe("TaskService", () => {
  const findById = vi.fn()
  const findPage = vi.fn()
  const countByStatus = vi.fn()
  const update = vi.fn()
  const deleteRow = vi.fn()
  let taskService: TaskService

  beforeEach(() => {
    vi.resetAllMocks()
    const taskDao: Partial<TaskDao> = { findById, findPage, countByStatus, update, delete: deleteRow }
    taskService = new TaskService(taskDao as TaskDao)
  })

  it("should serialise every timestamp as an ISO string when it returns a task", async () => {
    findById.mockResolvedValue(createTaskEntity({ completed: true, completedAt: new Date("2026-11-01T11:00:00.000Z") }))

    await expect(taskService.getTask(ID)).resolves.toEqual({
      ...TASK,
      completed: true,
      completedAt: "2026-11-01T11:00:00.000Z",
    })
  })

  it("should report the task as not found when it does not exist", async () => {
    findById.mockResolvedValue(null)

    await expect(taskService.getTask(ID)).rejects.toEqual(new ResourceNotFoundException("Task", ID))
  })

  it("should return the page with the paging it was asked for and the counts per status", async () => {
    findPage.mockResolvedValue([[createTaskEntity()], 7])
    countByStatus.mockResolvedValue({ all: 9, active: 7, completed: 2 })

    const page = await taskService.listTasks({ status: "active", limit: 1, offset: 3 })

    expect(page).toEqual({
      items: [TASK],
      total: 7,
      limit: 1,
      offset: 3,
      counts: { all: 9, active: 7, completed: 2 },
    })
  })

  it("should report the task as not found when an update matches no row and the task is gone", async () => {
    update.mockResolvedValue(null)
    findById.mockResolvedValue(null)

    await expect(taskService.updateTask(ID, { completed: true }, 1)).rejects.toEqual(
      new ResourceNotFoundException("Task", ID),
    )
  })

  it("should report a version mismatch with the current version when If-Match is stale", async () => {
    update.mockResolvedValue(null)
    findById.mockResolvedValue(createTaskEntity({ version: 5 }))

    await expect(taskService.updateTask(ID, { completed: true }, 2)).rejects.toEqual(
      new VersionMismatchException("Task", ID, 2, 5),
    )
  })

  it("should report the task as not found without re-reading it when an unconditional update matches no row", async () => {
    update.mockResolvedValue(null)

    await expect(taskService.updateTask(ID, { title: "x" })).rejects.toEqual(new ResourceNotFoundException("Task", ID))
    expect(findById).not.toHaveBeenCalled()
  })

  it("should report the task as not found when a delete matches no row", async () => {
    deleteRow.mockResolvedValue(false)

    await expect(taskService.deleteTask(ID)).rejects.toEqual(new ResourceNotFoundException("Task", ID))
  })
})

function createTaskEntity(overrides: Partial<TaskEntity> = {}): TaskEntity {
  return Object.assign(new TaskEntity(), {
    id: ID,
    title: "Buy milk",
    completed: false,
    completedAt: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    updatedAt: new Date("2026-11-01T10:00:00.000Z"),
    version: 1,
    ...overrides,
  })
}
