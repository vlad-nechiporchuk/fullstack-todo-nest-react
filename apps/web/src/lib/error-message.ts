import { ApiError } from "./api-client"

const VERSION_MISMATCH = "Someone else changed this task first. You are now seeing the latest version."
const NOT_FOUND = "This task no longer exists."
const FALLBACK = "Something went wrong. Please try again."

/** Field errors are shown as the API worded them. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return FALLBACK
  }

  if (error.status === 412) {
    return VERSION_MISMATCH
  }

  if (error.status === 404) {
    return NOT_FOUND
  }

  const fieldError = error.problem.errors?.[0]?.message
  if (fieldError) {
    return fieldError
  }

  return error.status < 500 && error.problem.detail ? error.problem.detail : FALLBACK
}
