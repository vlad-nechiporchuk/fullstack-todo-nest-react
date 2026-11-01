import { existsSync } from "node:fs"

/** Variables already set in the environment take precedence over the file. */
export function loadDotenvIfPresent(path = ".env"): void {
  if (existsSync(path)) {
    process.loadEnvFile(path)
  }
}
