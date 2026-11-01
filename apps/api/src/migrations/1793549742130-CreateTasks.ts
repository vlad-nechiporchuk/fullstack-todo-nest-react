import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateTasks1793549742130 implements MigrationInterface {
  name = "CreateTasks1793549742130"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL, "title" character varying(200) NOT NULL, "completed" boolean NOT NULL DEFAULT false, "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_tasks_completed_at" CHECK (("completed" AND "completed_at" IS NOT NULL) OR (NOT "completed" AND "completed_at" IS NULL)), CONSTRAINT "chk_tasks_title_not_blank" CHECK (btrim("title") <> ''), CONSTRAINT "pk_tasks" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_completed_created_at_id" ON "tasks" ("completed", "created_at", "id") `,
    )
    await queryRunner.query(`CREATE INDEX "idx_tasks_created_at_id" ON "tasks" ("created_at", "id") `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_tasks_created_at_id"`)
    await queryRunner.query(`DROP INDEX "public"."idx_tasks_completed_created_at_id"`)
    await queryRunner.query(`DROP TABLE "tasks"`)
  }
}
