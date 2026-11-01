import { taskPageSchema, taskSchema } from "@workspace/common"
import { createZodDto } from "nestjs-zod"

export class TaskResponseDto extends createZodDto(taskSchema) {}

export class TaskPageResponseDto extends createZodDto(taskPageSchema) {}
