import { ParseUUIDPipe } from "@nestjs/common"
import { InvalidRequestException } from "../errors/domain-errors"

/** Validates a `:id` route parameter; a bad id is a validation problem like any other bad input. */
export const PARSE_ID = new ParseUUIDPipe({
  version: "4",
  exceptionFactory: () => new InvalidRequestException("Invalid id", "An id is a UUID"),
})
