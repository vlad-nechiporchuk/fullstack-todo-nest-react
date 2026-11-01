import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { ListTasksParams, TaskCounts, UpdateTask } from "@workspace/common"
import { Repository } from "typeorm"
import { TaskEntity } from "./entities/task.entity"

@Injectable()
export class TaskDao {
  constructor(@InjectRepository(TaskEntity) private readonly repository: Repository<TaskEntity>) {}

  create(title: string): Promise<TaskEntity> {
    return this.repository.save(this.repository.create({ title }))
  }

  findById(id: string): Promise<TaskEntity | null> {
    return this.repository.findOneBy({ id })
  }

  findPage({ status, limit, offset }: ListTasksParams): Promise<[TaskEntity[], number]> {
    return this.repository.findAndCount({
      where: status === "all" ? {} : { completed: status === "completed" },
      order: { createdAt: "DESC", id: "DESC" },
      take: limit,
      skip: offset,
    })
  }

  async countByStatus(): Promise<TaskCounts> {
    const rows: { completed: boolean; count: number }[] = await this.repository
      .createQueryBuilder("task")
      .select("task.completed", "completed")
      .addSelect("count(*)::int", "count")
      .groupBy("task.completed")
      .getRawMany()

    const completed = rows.find((row) => row.completed)?.count ?? 0
    const active = rows.find((row) => !row.completed)?.count ?? 0

    return { all: active + completed, active, completed }
  }

  /**
   * One conditional UPDATE, so concurrent writers cannot lose each other's changes. The row is read back in the
   * same transaction, while the update still holds its lock, so the result is exactly what this call wrote.
   *
   * @param id - The task to change.
   * @param patch - The fields to change.
   * @param expectedVersion - When given, the row changes only while it is still at this version.
   * @returns The updated task, or `null` when no row matched: it is missing or its version has moved on.
   */
  update(id: string, patch: UpdateTask, expectedVersion?: number): Promise<TaskEntity | null> {
    return this.repository.manager.transaction(async (manager) => {
      const tasks = manager.getRepository(TaskEntity)
      const query = tasks
        .createQueryBuilder()
        .update()
        .set({
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.completed !== undefined && {
            completed: patch.completed,
            // Keep the original completion time when a completed task is completed again.
            completedAt: () => (patch.completed ? `CASE WHEN "completed" THEN "completed_at" ELSE now() END` : "NULL"),
          }),
          version: () => `"version" + 1`,
          updatedAt: () => "now()",
        })
        .where("id = :id", { id })

      if (expectedVersion !== undefined) {
        query.andWhere("version = :expectedVersion", { expectedVersion })
      }

      const result = await query.execute()

      return result.affected ? tasks.findOneBy({ id }) : null
    })
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id })

    return Boolean(result.affected)
  }
}
