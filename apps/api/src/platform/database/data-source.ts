import "reflect-metadata"
import { join } from "node:path"
import { DataSource } from "typeorm"
import { loadEnv } from "../../common/config/env"
import { loadDotenvIfPresent } from "../../common/config/load-dotenv"
import { databaseOptions } from "./database-options"

loadDotenvIfPresent()

/** TypeORM CLI data source; it runs from `dist`, so it loads the compiled entities. */
export default new DataSource({
  ...databaseOptions(loadEnv()),
  entities: [join(__dirname, "../../**/*.entity.js")],
})
