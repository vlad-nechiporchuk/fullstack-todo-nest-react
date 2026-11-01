import { describe, expect, it } from "vitest"
import type { ProblemException } from "../../errors/domain-errors"
import { ProblemType } from "../../errors/problem"
import { toBodyParserProblem } from "../json-body"

describe("toBodyParserProblem", () => {
  it("should map the error to a 400 validation problem when the JSON is unparsable", () => {
    const problem = toBodyParserProblem(
      createBodyParserError(400, "entity.parse.failed", "Unexpected end of JSON input"),
    )

    expect(summarizeProblem(problem)).toEqual({
      status: 400,
      problemType: ProblemType.validation,
      body: { title: "Malformed JSON body", detail: "The request body is not valid JSON" },
    })
  })

  it("should keep the status of the client error when the body is too large", () => {
    const problem = toBodyParserProblem(createBodyParserError(413, "entity.too.large", "request entity too large"))

    expect(summarizeProblem(problem)).toEqual({
      status: 413,
      problemType: "about:blank",
      body: { title: "Payload Too Large", detail: "request entity too large" },
    })
  })

  it("should leave the error alone when the body parser marks it as not exposable", () => {
    expect(
      toBodyParserProblem(createBodyParserError(500, "stream.not.readable", "stream broke", false)),
    ).toBeUndefined()
  })

  it("should leave the error alone when it does not come from the body parser", () => {
    expect(toBodyParserProblem(new Error("boom"))).toBeUndefined()
  })
})

// Body-parser raises http-errors objects: an Error carrying `status`, `type` and `expose`.
function createBodyParserError(status: number, type: string, message: string, expose = true): Error {
  return Object.assign(new Error(message), { status, statusCode: status, type, expose })
}

function summarizeProblem(problem: ProblemException | undefined) {
  return problem && { status: problem.getStatus(), problemType: problem.problemType, body: problem.getResponse() }
}
