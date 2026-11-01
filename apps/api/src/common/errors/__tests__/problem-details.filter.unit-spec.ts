import type { ArgumentsHost } from "@nestjs/common"
import { Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import { beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"
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
