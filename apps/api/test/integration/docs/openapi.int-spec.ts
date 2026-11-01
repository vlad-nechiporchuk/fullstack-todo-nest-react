import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createTestApp, type TestApp } from "../../support/create-test-app"

describe("API docs", () => {
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

  it("should serve Swagger UI without asking the browser to upgrade its requests to https", async () => {
    const response = await request(testApp.app.getHttpServer()).get("/docs").expect(200)

    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';" +
        "img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';" +
        "style-src 'self' https: 'unsafe-inline'",
    )
  })

  it.each(["swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js", "swagger-ui-init.js"])(
    "should serve the Swagger UI asset %s",
    async (asset) => {
      await request(testApp.app.getHttpServer()).get(`/docs/${asset}`).expect(200)
    },
  )
})
