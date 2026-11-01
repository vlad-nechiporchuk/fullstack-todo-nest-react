import type { ArgumentsHost } from "@nestjs/common"
import { Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import { createTaskSchema } from "@workspace/common"
import { ZodValidationException } from "nestjs-zod"
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"
import { ResourceNotFoundException, VersionMismatchException } from "../domain-errors"
import { type Problem, ProblemType } from "../problem"
import { ProblemDetailsFilter } from "../problem-details.filter"

const INSTANCE = "/api/v1/tasks/1"
const PROBLEM_JSON = "application/problem+json"

describe("ProblemDetailsFilter", () => {
  let logError: MockInstance

  beforeEach(() => {
    vi.restoreAllMocks()
    logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
  })

  it("should answer 404 with the not-found type when a resource is missing", () => {
    expect(catchWith(new ResourceNotFoundException("Task", "id1"))).toEqual(
      buildExpectedResponse({
        type: ProblemType.notFound,
        title: "Resource not found",
        status: 404,
        detail: "Task id1 does not exist",
      }),
    )
  })

  it("should answer 412 with both versions when If-Match is stale", () => {
    expect(catchWith(new VersionMismatchException("Task", "id1", 2, 5))).toEqual(
      buildExpectedResponse({
        type: ProblemType.preconditionFailed,
        title: "Version mismatch",
        status: 412,
        detail: "Task id1 is at version 5, but If-Match expected 2. Re-fetch it and retry.",
      }),
    )
  })

  it("should answer 400 with one entry per invalid field when the schema rejects the body", () => {
    const error = createTaskSchema.safeParse({ title: "" }).error

    expect(catchWith(new ZodValidationException(error))).toEqual(
      buildExpectedResponse({
        type: ProblemType.validation,
        title: "Validation failed",
        status: 400,
        detail: "The request does not match the expected schema",
        errors: [{ path: "title", message: "Title must not be empty" }],
      }),
    )
  })

  it("should keep the status and use the reason phrase as title when another HTTP exception is raised", () => {
    expect(catchWith(new NotFoundException("Cannot GET /nope"))).toEqual(
      buildExpectedResponse({ type: "about:blank", title: "Not Found", status: 404, detail: "Cannot GET /nope" }),
    )
  })

  it("should omit the detail when the exception carries no message of its own", () => {
    const healthCheckFailure = new ServiceUnavailableException({ status: "error", info: {}, error: {} })

    expect(catchWith(healthCheckFailure)).toEqual(
      buildExpectedResponse({ type: "about:blank", title: "Service Unavailable", status: 503 }),
    )
  })

  it("should hide an unexpected error behind a generic 500 and log it", () => {
    const error = new Error("connection string leaked")

    expect(catchWith(error)).toEqual(
      buildExpectedResponse({ type: ProblemType.internal, title: "Internal server error", status: 500 }),
    )
    expect(logError).toHaveBeenCalledWith(error)
  })
})

interface CaughtResponse {
  status: number
  contentType: string
  body: Problem
}

function catchWith(exception: unknown): CaughtResponse {
  const response = { status: vi.fn(), type: vi.fn(), json: vi.fn() }
  response.status.mockReturnValue(response)
  response.type.mockReturnValue(response)
  const httpHost: Partial<HttpArgumentsHost> = {
    getRequest: <T>() => ({ originalUrl: INSTANCE }) as T,
    getResponse: <T>() => response as T,
  }
  const host: Partial<ArgumentsHost> = { switchToHttp: () => httpHost as HttpArgumentsHost }

  new ProblemDetailsFilter().catch(exception, host as ArgumentsHost)

  return {
    status: response.status.mock.calls[0]?.[0],
    contentType: response.type.mock.calls[0]?.[0],
    body: response.json.mock.calls[0]?.[0],
  }
}

function buildExpectedResponse(problem: Omit<Problem, "instance">): CaughtResponse {
  return { status: problem.status, contentType: PROBLEM_JSON, body: { ...problem, instance: INSTANCE } }
}
