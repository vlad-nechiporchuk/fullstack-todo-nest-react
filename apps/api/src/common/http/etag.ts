import { InvalidRequestException } from "../errors/domain-errors"

const IF_MATCH_PATTERN = /^\s*(?:W\/)?"(\d+)"\s*$/
// The version column is a PostgreSQL integer: a larger number can never match and would fail the query.
const MAX_VERSION = 2_147_483_647

/** Strong ETag: the version changes on every write. */
export function toEtag(version: number): string {
  return `"${version}"`
}

/**
 * @param header - The raw `If-Match` header, if the client sent one.
 * @returns The version the client expects, or `undefined` when the header is absent or `*` (no precondition).
 * @throws {InvalidRequestException} When the header is present but is not an ETag such as `"3"`.
 */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined || header.trim() === "*") {
    return undefined
  }

  const digits = IF_MATCH_PATTERN.exec(header)?.[1]
  const version = digits === undefined ? Number.NaN : Number(digits)
  if (!Number.isInteger(version) || version < 1 || version > MAX_VERSION) {
    throw new InvalidRequestException("Invalid If-Match header", `If-Match must be an ETag such as "3", got: ${header}`)
  }

  return version
}
