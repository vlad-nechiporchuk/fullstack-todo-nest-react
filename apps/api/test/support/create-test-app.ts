import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import { DataSource } from "typeorm"
import { AppModule } from "../../src/app.module"
import { ENV } from "../../src/common/config/config.module"
import type { Env } from "../../src/common/config/env"
import { APP_OPTIONS, configureApp } from "../../src/configure-app"
import { TEST_ENV } from "./test-env"

export interface TestApp {
  app: NestExpressApplication
  dataSource: DataSource
  close(): Promise<void>
}

/** Same module graph and HTTP setup as production, against the test database. */
export async function createTestApp(): Promise<TestApp> {
  Object.assign(process.env, TEST_ENV)

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS)
  configureApp(app, app.get<Env>(ENV))
  await app.init()

  return { app, dataSource: app.get(DataSource), close: () => app.close() }
}

export async function resetTables(dataSource: DataSource, ...tables: string[]): Promise<void> {
  const list = tables.map((table) => `"${table}"`).join(", ")
  await dataSource.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
}
