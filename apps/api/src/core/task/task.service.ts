import { Injectable } from "@nestjs/common"
import type { CreateTask, ListTasksParams, Task, TaskPage, UpdateTask } from "@workspace/common"
import { ResourceNotFoundException, VersionMismatchException } from "../../common/errors/domain-errors"
import { TaskDao } from "./task.dao"
import { toTask } from "./task.mapper"

const RESOURCE = "Task"

@Injectable()
export class TaskService {
  constructor(private readonly taskDao: TaskDao) {}

  async listTasks(params: ListTasksParams): Promise<TaskPage> {
    const { entities, counts } = await this.taskDao.findPageWithCounts(params)

    return {
      items: entities.map(toTask),
      total: counts[params.status],
      limit: params.limit,
      offset: params.offset,
      counts,
    }
  }

  async getTask(id: string): Promise<Task> {
    const entity = await this.taskDao.findById(id)
    if (!entity) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }

    return toTask(entity)
  }

  async createTask(input: CreateTask): Promise<Task> {
    return toTask(await this.taskDao.create(input.title))
  }

  async updateTask(id: string, patch: UpdateTask, expectedVersions?: number[]): Promise<Task> {
    const updated = await this.taskDao.update(id, patch, expectedVersions)
    if (updated) {
      return toTask(updated)
    }

    if (expectedVersions === undefined) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }

    // The conditional update cannot tell a missing row from a stale version, so re-read to decide.
    const current = await this.taskDao.findById(id)
    if (!current) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }

    throw new VersionMismatchException(RESOURCE, id, current.version)
  }

  async deleteTask(id: string): Promise<void> {
    const isDeleted = await this.taskDao.delete(id)
    if (!isDeleted) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }
  }
}
