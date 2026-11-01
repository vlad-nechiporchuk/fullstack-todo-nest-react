import { QueryClient } from "@tanstack/react-query"
import { ZodError } from "zod"
import { ApiError } from "./api-client"

const MAX_RETRIES = 2

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => isTransient(error) && failureCount < MAX_RETRIES,
      },
    },
  })
}

/** Only a network failure or a 5xx can succeed on retry; a 4xx or a response that breaks the contract cannot. */
function isTransient(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500
  }

  return !(error instanceof ZodError)
}
