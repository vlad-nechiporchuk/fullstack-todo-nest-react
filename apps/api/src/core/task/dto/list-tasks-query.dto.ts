import { listTasksQuerySchema } from "@workspace/common"
import { createZodDto } from "nestjs-zod"

export class ListTasksQueryDto extends createZodDto(listTasksQuerySchema) {}
