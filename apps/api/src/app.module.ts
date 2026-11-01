import { randomUUID } from "node:crypto"
import { Module } from "@nestjs/common"
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { LoggerModule } from "nestjs-pino"
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod"
import { ConfigModule, ENV } from "./common/config/config.module"
import type { Env } from "./common/config/env"
import { ProblemDetailsFilter } from "./common/errors/problem-details.filter"
import { TaskModule } from "./core/task/task.module"
import { DatabaseModule } from "./platform/database/database.module"
import { HealthModule } from "./platform/health/health.module"

const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          transport:
            env.NODE_ENV === "development" ? { target: "pino-pretty", options: { singleLine: true } } : undefined,
          // Reuse the caller's / load balancer's request id so one id follows a request across services.
          genReqId: (req, res) => {
            const incoming = req.headers["x-request-id"]
            const id = typeof incoming === "string" && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID()
            res.setHeader("X-Request-Id", id)
            return id
          },
          redact: ["req.headers.authorization", "req.headers.cookie"],
          autoLogging: { ignore: (req) => req.url?.startsWith("/api/health") ?? false },
        },
      }),
    }),
    DatabaseModule,
    HealthModule,
    TaskModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
