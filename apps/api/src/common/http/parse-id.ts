import { ParseUUIDPipe } from "@nestjs/common"
import { InvalidRequestException } from "../errors/domain-errors"

/** A bad id is a validation problem like any other bad input, not Nest's generic 400. */
export const PARSE_ID = new ParseUUIDPipe({
  exceptionFactory: () => new InvalidRequestException("Invalid id", "An id is a UUID"),
})
