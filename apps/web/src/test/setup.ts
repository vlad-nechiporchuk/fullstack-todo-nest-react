import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"
import { server } from "./msw-server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  cleanup()
  window.history.replaceState(null, "", "/")
  server.resetHandlers()
  server.events.removeAllListeners()
})
afterAll(() => server.close())
