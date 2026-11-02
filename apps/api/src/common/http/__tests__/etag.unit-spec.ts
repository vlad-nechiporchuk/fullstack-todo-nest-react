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
    ["absent", undefined],
    ["a wildcard", "*"],
  ])("should return no precondition when the header is %s", (_case, header) => {
    expect(parseIfMatch(header)).toBeUndefined()
  })

  it.each([
    ["a strong ETag", '"3"', [3]],
    ["an ETag with surrounding spaces", ' "7" ', [7]],
    ["a list of ETags", '"1", "2"', [1, 2]],
    ["the largest version the database holds", '"2147483647"', [2147483647]],
    ["a list with a comma inside one tag", '"a,b", "4"', [4]],
    ["a weak ETag beside a strong one", 'W/"1", "2"', [2]],
    ["a weak ETag", 'W/"12"', []],
    ["a tag this API never issues", '"abc"', []],
    ["version zero", '"0"', []],
    ["a version past the database integer", '"2147483648"', []],
    ["a version past a safe JavaScript integer", '"99999999999999999999999"', []],
  ])("should return the versions a strong comparison can match when the header is %s", (_case, header, expected) => {
    expect(parseIfMatch(header)).toEqual(expected)
  })

  it.each([["3"], ['"3'], ["W/3"], ['"3" "4"'], ['"3",']])("should reject %s as a validation problem", (header) => {
    expect(catchError(() => parseIfMatch(header))).toEqual(
      new InvalidRequestException(
        "Invalid If-Match header",
        `If-Match must be * or a list of ETags such as "3", got: ${header}`,
      ),
    )
  })
})

function catchError(action: () => unknown): unknown {
  try {
    action()
  } catch (error) {
    return error
  }
  return undefined
}
