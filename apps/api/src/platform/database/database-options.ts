import { join } from "node:path"
import type { DataSourceOptions } from "typeorm"
import type { Env } from "../../common/config/env"

/** No entities here: the app registers them through its modules (`autoLoadEntities`). */
export function databaseOptions(env: Pick<Env, "DATABASE_URL" | "DATABASE_POOL_SIZE">): DataSourceOptions {
  return {
    type: "postgres",
    url: env.DATABASE_URL,
    migrations: [join(__dirname, "../../migrations/*.{js,ts}")],
    migrationsTableName: "migrations",
    synchronize: false,
    extra: { max: env.DATABASE_POOL_SIZE },
  }
}
