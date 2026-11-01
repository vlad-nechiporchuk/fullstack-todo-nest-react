import { createTaskSchema } from "@workspace/common"
import { createZodDto } from "nestjs-zod"

export class CreateTaskDto extends createZodDto(createTaskSchema) {}
