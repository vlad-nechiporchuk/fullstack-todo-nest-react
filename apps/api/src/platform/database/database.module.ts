import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ENV } from "../../common/config/config.module"
import type { Env } from "../../common/config/env"
import { databaseOptions } from "./database-options"

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ ...databaseOptions(env), autoLoadEntities: true }),
    }),
  ],
})
export class DatabaseModule {}
