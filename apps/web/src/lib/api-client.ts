import { type Problem, problemSchema } from "@workspace/common"
import type { z } from "zod"

const API_BASE = "/api/v1"

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title)
    this.name = "ApiError"
  }

  get status(): number {
    return this.problem.status
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Sends a request below `/api/v1` (the path may carry a query string) and validates the JSON response against the
 * shared contract.
 *
 * @throws {ApiError} The API answered with an error status.
 */
export async function requestJson<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options: RequestOptions = {},
): Promise<z.output<Schema>> {
  const response = await send(path, options)

  return schema.parse(await response.json())
}

export async function requestNoContent(path: string, options: RequestOptions = {}): Promise<void> {
  await send(path, options)
}

async function send(path: string, { method = "GET", body, headers }: RequestOptions): Promise<Response> {
  const response = await fetch(new URL(`${API_BASE}${path}`, window.location.origin), {
    method,
    headers: {
      Accept: "application/json, application/problem+json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw new ApiError(await readProblem(response))
  }

  return response
}

// A proxy in front of the API can answer with its own HTML error page, so a missing problem body is not an error.
async function readProblem(response: Response): Promise<Problem> {
  const fallback: Problem = {
    type: "about:blank",
    title: response.statusText || "Request failed",
    status: response.status,
  }
  if (!response.headers.get("content-type")?.includes("json")) {
    return fallback
  }

  const parsed = problemSchema.safeParse(await response.json().catch(() => undefined))

  return parsed.success ? parsed.data : fallback
}
