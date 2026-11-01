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
    expect(Object.keys(response.body.paths).sort()).toEqual([
      "/api/health/live",
      "/api/health/ready",
      "/api/v1/tasks",
      "/api/v1/tasks/{id}",
    ])
  })

  it("should document each error status of an endpoint as a problem+json body", async () => {
    const response = await request(testApp.app.getHttpServer()).get("/docs-json").expect(200)

    expect(response.body.paths["/api/v1/tasks/{id}"].patch.responses).toEqual({
      "200": {
        description: "The updated task",
        content: { "application/json": { schema: { $ref: "#/components/schemas/TaskResponseDto_Output" } } },
      },
      "400": buildExpectedProblemResponse("Bad Request"),
      "404": buildExpectedProblemResponse("Not Found"),
      "412": buildExpectedProblemResponse("Precondition Failed"),
    })
    expect(Object.keys(response.body.components.schemas).sort()).toEqual([
      "CreateTaskDto",
      "ProblemResponseDto",
      "TaskPageResponseDto_Output",
      "TaskResponseDto_Output",
      "UpdateTaskDto",
    ])
  })
})

function buildExpectedProblemResponse(description: string) {
  return {
    description,
    content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemResponseDto" } } },
  }
}
