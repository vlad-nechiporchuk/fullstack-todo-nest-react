import { STATUS_CODES } from "node:http"
import type { Problem } from "@workspace/common"

export const PROBLEM_CONTENT_TYPE = "application/problem+json"

/** Clients branch on `type`, never on `title` or `detail`. */
export const ProblemType = {
  validation: "https://todo.example/problems/validation-error",
  notFound: "https://todo.example/problems/not-found",
  preconditionFailed: "https://todo.example/problems/version-mismatch",
  internal: "https://todo.example/problems/internal-error",
  generic: "about:blank",
} as const

export type { Problem }

/** RFC 9457: a problem with `type: "about:blank"` uses the HTTP reason phrase as its title, e.g. "Not Found". */
export function statusPhrase(status: number): string {
  return STATUS_CODES[status] ?? "Error"
}
