import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from "@nestjs/terminus"

const DATABASE_PING_TIMEOUT_MS = 1500

@ApiTags("Health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly typeOrmHealthIndicator: TypeOrmHealthIndicator,
  ) {}

  @Get("live")
  @HealthCheck()
  @ApiOperation({
    summary: "Liveness probe",
    description: "Checks no dependencies, so a database outage does not restart every replica.",
  })
  checkLiveness() {
    return this.healthCheckService.check([])
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({
    summary: "Readiness probe",
    description: "Answers 503 while the database is unreachable, so the instance is taken out of rotation.",
  })
  checkReadiness() {
    return this.healthCheckService.check([
      () => this.typeOrmHealthIndicator.pingCheck("database", { timeout: DATABASE_PING_TIMEOUT_MS }),
    ])
  }
}
