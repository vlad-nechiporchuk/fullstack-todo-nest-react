import "reflect-metadata"
import { DataSource } from "typeorm"
import { loadEnv } from "../../common/config/env"
import { loadDotenvIfPresent } from "../../common/config/load-dotenv"
import { COMPILED_MIGRATIONS, databaseOptions } from "./database-options"

/** Runs as its own release step, not on API boot, so replicas never race each other to migrate. */
async function migrate(): Promise<void> {
  loadDotenvIfPresent()
  const dataSource = new DataSource({ ...databaseOptions(loadEnv()), migrations: [COMPILED_MIGRATIONS] })
  await dataSource.initialize()
  try {
    const applied = await dataSource.runMigrations({ transaction: "each" })
    const names = applied.map((migration) => migration.name).join(", ") || "none"
    console.log(`Migrations applied: ${names}`)
  } finally {
    await dataSource.destroy()
  }
}

migrate().catch((error: unknown) => {
  console.error("Migration failed", error)
  process.exit(1)
})
