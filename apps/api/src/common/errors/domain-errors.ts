import { HttpException, HttpStatus } from "@nestjs/common"
import { ProblemType } from "./problem"

export class ProblemException extends HttpException {
  constructor(
    readonly problemType: string,
    status: HttpStatus,
    title: string,
    detail?: string,
  ) {
    super({ title, detail }, status)
  }
}

export class ResourceNotFoundException extends ProblemException {
  constructor(resource: string, id: string) {
    super(ProblemType.notFound, HttpStatus.NOT_FOUND, "Resource not found", `${resource} ${id} does not exist`)
  }
}

export class VersionMismatchException extends ProblemException {
  constructor(resource: string, id: string, expected: number, actual: number) {
    super(
      ProblemType.preconditionFailed,
      HttpStatus.PRECONDITION_FAILED,
      "Version mismatch",
      `${resource} ${id} is at version ${actual}, but If-Match expected ${expected}. Re-fetch it and retry.`,
    )
  }
}
