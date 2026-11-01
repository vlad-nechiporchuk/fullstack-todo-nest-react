import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app.module"
import { ENV } from "./common/config/config.module"
import type { Env } from "./common/config/env"
import { loadDotenvIfPresent } from "./common/config/load-dotenv"
import { APP_OPTIONS, configureApp } from "./configure-app"

async function bootstrap(): Promise<void> {
  loadDotenvIfPresent()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, APP_OPTIONS)
  const env = app.get<Env>(ENV)
  configureApp(app, env)
  await app.listen(env.PORT, "0.0.0.0")
}

void bootstrap()
