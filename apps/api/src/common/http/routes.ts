export const API_PREFIX = "api"

export const API_VERSION = "1"

/** The path a client calls for a route of the current API version, e.g. `/api/v1/tasks/<id>`. */
export function toVersionedPath(...segments: string[]): string {
  return `/${API_PREFIX}/v${API_VERSION}/${segments.join("/")}`
}
