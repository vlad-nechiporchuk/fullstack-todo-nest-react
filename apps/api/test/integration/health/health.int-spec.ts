import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createTestApp, type TestApp } from "../../support/create-test-app"

describe("GET /api/health", () => {
  let testApp: TestApp

  beforeAll(async () => {
    testApp = await createTestApp()
  })

  afterAll(() => testApp.close())

  it("should report liveness without checking any dependency", async () => {
    const response = await request(testApp.app.getHttpServer()).get("/api/health/live").expect(200)

    expect(response.body).toEqual({ status: "ok", info: {}, error: {}, details: {} })
  })

  it("should report readiness when the database answers", async () => {
    const response = await request(testApp.app.getHttpServer()).get("/api/health/ready").expect(200)

    expect(response.body).toEqual({
      status: "ok",
      info: { database: { status: "up" } },
      error: {},
      details: { database: { status: "up" } },
    })
  })
})
