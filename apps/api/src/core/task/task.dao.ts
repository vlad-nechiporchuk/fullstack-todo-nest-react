import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { ListTasksParams, TaskCounts, UpdateTask } from "@workspace/common"
import { Repository } from "typeorm"
import { TaskEntity } from "./entities/task.entity"

export interface TaskPageRows {
  entities: TaskEntity[]
  counts: TaskCounts
}

@Injectable()
export class TaskDao {
  constructor(@InjectRepository(TaskEntity) private readonly repository: Repository<TaskEntity>) {}

  create(title: string): Promise<TaskEntity> {
    return this.repository.save(this.repository.create({ title }))
  }

  findById(id: string): Promise<TaskEntity | null> {
    return this.repository.findOneBy({ id })
  }

  /** Reads the page and the counts from one snapshot, so the two never disagree. */
  findPageWithCounts({ status, limit, offset }: ListTasksParams): Promise<TaskPageRows> {
    return this.repository.manager.transaction("REPEATABLE READ", async (manager) => {
      const tasks = manager.getRepository(TaskEntity)
      const entities = await tasks.find({
        where: status === "all" ? {} : { completed: status === "completed" },
        order: { createdAt: "DESC", id: "DESC" },
        take: limit,
        skip: offset,
      })
      const counts = await countByStatus(tasks)

      return { entities, counts }
    })
  }

  /**
   * One conditional UPDATE, so concurrent writers cannot lose each other's changes. The row is read back in the
   * same transaction, while the update still holds its lock, so the result is exactly what this call wrote.
   *
   * @param id - The task to change.
   * @param patch - The fields to change.
   * @param expectedVersions - When given, the row changes only while it is at one of these versions.
   * @returns The updated task, or `null` when no row matched: it is missing or its version has moved on.
   */
  update(id: string, patch: UpdateTask, expectedVersions?: number[]): Promise<TaskEntity | null> {
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

      // ANY over an array rather than IN: an empty list is valid SQL here and matches no row.
      if (expectedVersions !== undefined) {
        query.andWhere("version = ANY(CAST(:expectedVersions AS integer[]))", { expectedVersions })
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

async function countByStatus(tasks: Repository<TaskEntity>): Promise<TaskCounts> {
  const rows: { completed: boolean; count: number }[] = await tasks
    .createQueryBuilder("task")
    .select("task.completed", "completed")
    .addSelect("count(*)::int", "count")
    .groupBy("task.completed")
    .getRawMany()

  const completed = rows.find((row) => row.completed)?.count ?? 0
  const active = rows.find((row) => !row.completed)?.count ?? 0

  return { all: active + completed, active, completed }
}
