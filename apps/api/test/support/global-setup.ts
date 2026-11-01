import { spawn } from "node:child_process"
import { join } from "node:path"
import { DataSource } from "typeorm"
import { TEST_DATABASE_URL } from "./test-env"

const MIGRATE_SCRIPT = join(__dirname, "../../dist/platform/database/migrate.js")

/** Rebuilds the test database from an empty schema with the release migrator, exactly as a first deployment does. */
export default async function prepareTestDatabase(): Promise<void> {
  await resetSchema()
  await runMigrations()
}

async function resetSchema(): Promise<void> {
  const database = new URL(TEST_DATABASE_URL).pathname.slice(1)
  if (!database.endsWith("_test")) {
    throw new Error(`Refusing to wipe "${database}": the integration tests only reset a database named *_test`)
  }

  const dataSource = await new DataSource({ type: "postgres", url: TEST_DATABASE_URL }).initialize()
  try {
    await dataSource.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
  } finally {
    await dataSource.destroy()
  }
}

function runMigrations(): Promise<void> {
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
