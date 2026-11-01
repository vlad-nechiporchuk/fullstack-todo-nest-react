import { describe, expect, it } from "vitest"
import { ZodError } from "zod"
import { ApiError } from "../api-client"
import { createQueryClient } from "../query-client"

describe("createQueryClient", () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry
  if (typeof retry !== "function") {
    throw new Error("expected a retry function")
  }

  it.each([
    ["a network failure", new TypeError("Failed to fetch"), 0, true],
    ["a 503", new ApiError({ type: "about:blank", title: "Service Unavailable", status: 503 }), 1, true],
    [
      "a 503 after two retries",
      new ApiError({ type: "about:blank", title: "Service Unavailable", status: 503 }),
      2,
      false,
    ],
    ["a 404", new ApiError({ type: "about:blank", title: "Not Found", status: 404 }), 0, false],
    ["a response that breaks the contract", new ZodError([]), 0, false],
  ])("should decide whether to retry %s", (_case, error, failureCount, expected) => {
    expect(retry(failureCount, error)).toBe(expected)
  })
})
