import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Always returns 200. Used by container orchestrators to check if the process is alive.',
  })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Checks database connectivity. Returns 200 when the service is ready to accept traffic, 503 otherwise.',
  })
  @ApiOkResponse({
    description: 'Service is ready — all health indicators passed',
  })
  async ready() {
    try {
      return await this.health.check([
        () => this.prismaIndicator.pingCheck('database', this.prisma),
      ]);
    } catch {
      // Terminus' 503 body carries the DB error (host, port): not on an
      // unauthenticated route. The status code is the probe contract.
      throw new ServiceUnavailableException('Service not ready');
    }
  }
}
