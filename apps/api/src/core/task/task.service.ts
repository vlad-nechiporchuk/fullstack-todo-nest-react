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
    const [[entities, total], counts] = await Promise.all([this.taskDao.findPage(params), this.taskDao.countByStatus()])

    return { items: entities.map(toTask), total, limit: params.limit, offset: params.offset, counts }
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

  async updateTask(id: string, patch: UpdateTask, expectedVersion?: number): Promise<Task> {
    const updated = await this.taskDao.update(id, patch, expectedVersion)
    if (updated) {
      return toTask(updated)
    }

    if (expectedVersion === undefined) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }

    // The conditional update cannot tell a missing row from a stale version, so re-read to decide.
    const current = await this.taskDao.findById(id)
    if (!current) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }

    throw new VersionMismatchException(RESOURCE, id, expectedVersion, current.version)
  }

  async deleteTask(id: string): Promise<void> {
    const isDeleted = await this.taskDao.delete(id)
    if (!isDeleted) {
      throw new ResourceNotFoundException(RESOURCE, id)
    }
  }
}
