import { join } from "node:path"
import type { DataSourceOptions } from "typeorm"
import type { Env } from "../../common/config/env"
import { NamingStrategy } from "./naming-strategy"

/** Migrations run from `dist`, as a release step; the app itself never loads them. */
export const COMPILED_MIGRATIONS = join(__dirname, "../../migrations/*.js")

/** No entities or migrations here: the app registers entities through its modules (`autoLoadEntities`). */
export function databaseOptions(env: Pick<Env, "DATABASE_URL" | "DATABASE_POOL_SIZE">): DataSourceOptions {
  return {
    type: "postgres",
    url: env.DATABASE_URL,
    migrationsTableName: "migrations",
    synchronize: false,
    namingStrategy: new NamingStrategy(),
    // PostgreSQL 13+ has gen_random_uuid() built in; TypeORM would otherwise need CREATE EXTENSION rights on connect.
    uuidExtension: "pgcrypto",
    installExtensions: false,
    extra: { max: env.DATABASE_POOL_SIZE },
  }
}
