import "reflect-metadata"
import { DataSource } from "typeorm"
import { databaseOptions } from "../../src/platform/database/database-options"
import { TEST_DATABASE_URL } from "./test-env"

export default async function migrateTestDatabase(): Promise<void> {
  const dataSource = new DataSource(databaseOptions({ DATABASE_URL: TEST_DATABASE_URL, DATABASE_POOL_SIZE: 2 }))
  await dataSource.initialize()
  try {
    await dataSource.runMigrations({ transaction: "each" })
  } finally {
    await dataSource.destroy()
  }
}
