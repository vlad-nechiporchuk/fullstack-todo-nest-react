import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common"
import type { Request, Response } from "express"
import { ZodValidationException } from "nestjs-zod"
import type { ZodError } from "zod"
import { ProblemException } from "./domain-errors"
import { PROBLEM_CONTENT_TYPE, type Problem, ProblemType, statusPhrase } from "./problem"

/** Unexpected errors become a generic 500; their stack goes only to the log. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()

    const problem = { ...this.toProblem(exception), instance: request.originalUrl }
    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception)
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem)
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof ZodValidationException) {
      return {
        type: ProblemType.validation,
        title: "Validation failed",
        status: HttpStatus.BAD_REQUEST,
        detail: "The request does not match the expected schema",
        errors: toFieldErrors(exception.getZodError() as ZodError),
      }
    }

    if (exception instanceof ProblemException) {
      const body = exception.getResponse() as { title: string; detail?: string }
      return { type: exception.problemType, status: exception.getStatus(), ...body }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const title = statusPhrase(status)
      const detail = ownMessage(exception)
      return { type: ProblemType.generic, title, status, ...(detail && detail !== title && { detail }) }
    }

    return { type: ProblemType.internal, title: "Internal server error", status: HttpStatus.INTERNAL_SERVER_ERROR }
  }
}

/** Only a message the exception was raised with; Nest otherwise fills in one derived from the class name. */
function ownMessage(exception: HttpException): string | undefined {
  const response = exception.getResponse()
  if (typeof response === "string") {
    return response
  }
  const message = (response as { message?: unknown }).message
  if (typeof message === "string") {
    return message
  }
  return Array.isArray(message) ? message.join("; ") : undefined
}

function toFieldErrors(error: ZodError): Problem["errors"] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }))
}
