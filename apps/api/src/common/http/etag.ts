import { InvalidRequestException } from "../errors/domain-errors"

// RFC 9110 entity-tag: an optional weak prefix and a quoted opaque tag, which may itself contain commas.
const ENTITY_TAG = String.raw`(W\/)?"([\x21\x23-\x7E]*)"`
const ENTITY_TAG_LIST = new RegExp(String.raw`^\s*${ENTITY_TAG}(?:\s*,\s*${ENTITY_TAG})*\s*$`)
const VERSION = /^[1-9]\d*$/
// The version column is a PostgreSQL integer: a larger number can never match and would fail the query.
const MAX_VERSION = 2_147_483_647

/** Strong ETag: the version changes on every write. */
export function toEtag(version: number): string {
  return `"${version}"`
}

/**
 * Reads `If-Match` with the strong comparison RFC 9110 requires: a weak tag, or a tag this API never issues, matches
 * no version, so a list of only such tags yields an empty list and the update answers 412.
 *
 * @param header - The raw `If-Match` header, if the client sent one.
 * @returns The versions the client accepts, or `undefined` when the header is absent or `*` (no precondition).
 * @throws {InvalidRequestException} When the header is present but is not `*` or a list of entity tags.
 */
export function parseIfMatch(header: string | undefined): number[] | undefined {
  if (header === undefined || header.trim() === "*") {
    return undefined
  }

  if (!ENTITY_TAG_LIST.test(header)) {
    throw new InvalidRequestException(
      "Invalid If-Match header",
      `If-Match must be * or a list of ETags such as "3", got: ${header}`,
    )
  }

  return [...header.matchAll(new RegExp(ENTITY_TAG, "g"))]
    .filter(([, weak]) => weak === undefined)
    .map(([, , tag = ""]) => tag)
    .filter((tag) => VERSION.test(tag))
    .map(Number)
    .filter((version) => version <= MAX_VERSION)
}
