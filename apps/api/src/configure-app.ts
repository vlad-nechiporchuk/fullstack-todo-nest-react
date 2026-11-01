import { type NestApplicationOptions, VersioningType } from "@nestjs/common"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import helmet from "helmet"
import { Logger } from "nestjs-pino"
import { cleanupOpenApiDoc } from "nestjs-zod"
import type { Env } from "./common/config/env"
import { jsonBody } from "./common/http/json-body"

/** Nest's own body parser is off: `configureApp` registers one with a size limit and problem responses. */
export const APP_OPTIONS: NestApplicationOptions = { bufferLogs: true, bodyParser: false }

export function configureApp(app: NestExpressApplication, env: Env): void {
  app.useLogger(app.get(Logger))
  app.enableShutdownHooks()

  // TLS ends in front of the API, so over plain http this directive would make browsers refetch Swagger UI over https.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }))
  app.use(...jsonBody())
  if (env.CORS_ORIGINS.length > 0) {
    app.enableCors({ origin: env.CORS_ORIGINS, exposedHeaders: ["ETag", "Location", "X-Request-Id"] })
  }

  app.setGlobalPrefix("api")
  app.enableVersioning({ type: VersioningType.URI })

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle("ToDo API")
      .setDescription(
        "Create, list, update, complete and delete tasks. Errors are RFC 9457 problem+json. " +
          "Every task carries a `version`; send it back as `If-Match` to avoid overwriting someone else's change.",
      )
      .setVersion("1.0")
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("docs", app, cleanupOpenApiDoc(document))
  }
}
