import { HttpStatus } from "@nestjs/common"
import { type ErrorRequestHandler, json, type RequestHandler } from "express"
import { ProblemException } from "../errors/domain-errors"
import { ProblemType, statusPhrase } from "../errors/problem"

const JSON_BODY_LIMIT = "100kb"

interface HttpError extends Error {
  status: number
  type: string
  expose: boolean
}

function isBodyParserError(error: unknown): error is HttpError {
  const candidate = error as Partial<HttpError>
  return error instanceof Error && typeof candidate.status === "number" && typeof candidate.type === "string"
}

/** Without this, unparsable JSON answers with the parser's raw message and an oversized body with a 500. */
export function toBodyParserProblem(error: unknown): ProblemException | undefined {
  if (!isBodyParserError(error) || !error.expose) {
    return undefined
  }
  if (error.type === "entity.parse.failed") {
    return new ProblemException(
      ProblemType.validation,
      HttpStatus.BAD_REQUEST,
      "Malformed JSON body",
      "The request body is not valid JSON",
    )
  }
  return new ProblemException(ProblemType.generic, error.status, statusPhrase(error.status), error.message)
}

export function jsonBody(): [RequestHandler, ErrorRequestHandler] {
  return [
    json({ limit: JSON_BODY_LIMIT }),
    (error, _req, _res, next) => {
      next(toBodyParserProblem(error) ?? error)
    },
  ]
}
