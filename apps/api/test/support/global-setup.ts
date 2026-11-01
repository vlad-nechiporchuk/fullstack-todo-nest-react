import { spawn } from "node:child_process"
import { join } from "node:path"
import { TEST_DATABASE_URL } from "./test-env"

const MIGRATE_SCRIPT = join(__dirname, "../../dist/platform/database/migrate.js")

/** Applies migrations to the test database with the release migrator, exactly as a deployment does. */
export default function migrateTestDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [MIGRATE_SCRIPT], {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DATABASE_POOL_SIZE: "2" },
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${MIGRATE_SCRIPT} exited with code ${String(code)}; is the API built (nest build)?`))
      }
    })
  })
}
