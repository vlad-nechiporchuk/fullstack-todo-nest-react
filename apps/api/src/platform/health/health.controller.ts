import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"
import { HealthCheck, HealthCheckService } from "@nestjs/terminus"

@ApiTags("Health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @Get("live")
  @HealthCheck()
  @ApiOperation({
    summary: "Liveness probe",
    description: "Checks no dependencies, so a database outage does not restart every replica.",
  })
  checkLiveness() {
    return this.healthCheckService.check([])
  }
}
