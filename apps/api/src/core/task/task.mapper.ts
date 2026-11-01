import type { Task } from "@workspace/common"
import type { TaskEntity } from "./entities/task.entity"

export function toTask(entity: TaskEntity): Task {
  return {
    id: entity.id,
    title: entity.title,
    completed: entity.completed,
    completedAt: entity.completedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    version: entity.version,
  }
}
