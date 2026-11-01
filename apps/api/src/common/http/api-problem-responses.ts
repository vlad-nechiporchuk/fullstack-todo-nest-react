import { applyDecorators, type HttpStatus } from "@nestjs/common"
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger"
import { problemSchema } from "@workspace/common"
import { createZodDto } from "nestjs-zod"
import { PROBLEM_CONTENT_TYPE, statusPhrase } from "../errors/problem"

class ProblemResponseDto extends createZodDto(problemSchema) {}

/** Documents error statuses with the `application/problem+json` body `ProblemDetailsFilter` sends for them. */
export function ApiProblemResponses(...statuses: HttpStatus[]) {
  return applyDecorators(
    ApiExtraModels(ProblemResponseDto),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: statusPhrase(status),
        content: { [PROBLEM_CONTENT_TYPE]: { schema: { $ref: getSchemaPath(ProblemResponseDto) } } },
      }),
    ),
  )
}
