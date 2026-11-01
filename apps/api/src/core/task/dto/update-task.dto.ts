import { updateTaskSchema } from "@workspace/common"
import { createZodDto } from "nestjs-zod"

export class UpdateTaskDto extends createZodDto(updateTaskSchema) {}
