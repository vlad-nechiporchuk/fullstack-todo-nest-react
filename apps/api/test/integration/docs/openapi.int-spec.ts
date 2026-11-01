import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createTestApp, type TestApp } from "../../support/create-test-app"

describe("GET /docs-json", () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp()
  })

  afterAll(() => testApp.close())

  it("should serve the OpenAPI document with every public path", async () => {
    const response = await request(testApp.app.getHttpServer()).get("/docs-json").expect(200)

    expect(response.body.info).toEqual({
      title: "ToDo API",
      description:
        "Create, list, update, complete and delete tasks. Errors are RFC 9457 problem+json. " +
        "Every task carries a `version`; send it back as `If-Match` to avoid overwriting someone else's change.",
      version: "1.0",
      contact: {},
    })
    expect(Object.keys(response.body.paths).sort()).toEqual(["/api/health/live", "/api/health/ready"])
  })
})
