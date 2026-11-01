import { beforeEach, describe, expect, it, vi } from "vitest"
import { ResourceNotFoundException } from "../../../common/errors/domain-errors"
import type { TaskDao } from "../task.dao"
import { TaskService } from "../task.service"

const ID = "4c1b8f6e-2a59-4d1e-9a3c-0f6f1b2d3e4a"

describe("TaskService", () => {
  const findById = vi.fn()
  const update = vi.fn()
  let taskService: TaskService

  beforeEach(() => {
    vi.resetAllMocks()
    const taskDao: Partial<TaskDao> = { findById, update }
    taskService = new TaskService(taskDao as TaskDao)
  })

  it("should report the task as not found, not a version mismatch, when a conditional update finds it gone", async () => {
    update.mockResolvedValue(null)
    findById.mockResolvedValue(null)

    await expect(taskService.updateTask(ID, { completed: true }, 1)).rejects.toEqual(
      new ResourceNotFoundException("Task", ID),
    )
  })

  it("should report the task as not found without re-reading it when an unconditional update matches no row", async () => {
    update.mockResolvedValue(null)

    await expect(taskService.updateTask(ID, { title: "x" })).rejects.toEqual(new ResourceNotFoundException("Task", ID))
    expect(findById).not.toHaveBeenCalled()
  })
})
