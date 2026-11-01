import { TASK_TITLE_MAX_LENGTH } from "@workspace/common"
import { Check, Column, Entity, Index } from "typeorm"
import { BaseEntity } from "../../../common/entities/base.entity"

@Entity({ name: "tasks" })
@Index("idx_tasks_created_at_id", ["createdAt", "id"])
@Index("idx_tasks_completed_created_at_id", ["completed", "createdAt", "id"])
@Check("chk_tasks_title_not_blank", `btrim("title") <> ''`)
@Check(
  "chk_tasks_completed_at",
  `("completed" AND "completed_at" IS NOT NULL) OR (NOT "completed" AND "completed_at" IS NULL)`,
)
export class TaskEntity extends BaseEntity {
  @Column({ type: "varchar", length: TASK_TITLE_MAX_LENGTH })
  title: string

  @Column({ type: "boolean", default: false })
  completed: boolean

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt: Date | null
}
