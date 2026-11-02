export const ROW_EXIT_MS = 200

/** Resolves once a closing task row has finished its transition, or at once when reduced motion is preferred. */
export function waitForRowExit(): Promise<void> {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return Promise.resolve()
  }

  return new Promise((resolve) => setTimeout(resolve, ROW_EXIT_MS))
}
