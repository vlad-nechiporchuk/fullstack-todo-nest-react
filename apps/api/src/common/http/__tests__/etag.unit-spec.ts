import { describe, expect, it } from "vitest"
import { InvalidRequestException } from "../../errors/domain-errors"
import { parseIfMatch, toEtag } from "../etag"

describe("toEtag", () => {
  it("should quote the version", () => {
    expect(toEtag(3)).toBe('"3"')
  })
})

describe("parseIfMatch", () => {
  it.each([
    ["absent", undefined, undefined],
    ["a wildcard", "*", undefined],
    ["a strong ETag", '"3"', 3],
    ["a weak ETag", 'W/"12"', 12],
    ["an ETag with surrounding spaces", ' "7" ', 7],
    ["the largest version the database holds", '"2147483647"', 2147483647],
  ])("should return the expected version when the header is %s", (_case, header, expected) => {
    expect(parseIfMatch(header)).toBe(expected)
  })

  it.each([["3"], ['"abc"'], ['"3", "4"'], ['"0"'], ['"2147483648"'], ['"99999999999999999999999"']])(
    "should reject %s as a validation problem",
    (header) => {
      expect(catchError(() => parseIfMatch(header))).toEqual(
        new InvalidRequestException("Invalid If-Match header", `If-Match must be an ETag such as "3", got: ${header}`),
      )
    },
  )
})

function catchError(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    return error
  }
  return undefined
}
