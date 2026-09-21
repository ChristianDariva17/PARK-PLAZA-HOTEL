import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/decorators/public.decorator.js';
import type { Environment } from '../config/environment.js';
import { MetricsService } from './metrics.service.js';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get()
  async metricsEndpoint(
    @Headers('x-metrics-token') token: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const expected = this.config.get('METRICS_TOKEN', { infer: true });
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (expected && !matchesToken(token || bearerToken, expected)) throw new UnauthorizedException('Invalid metrics token');
    if (this.config.get('NODE_ENV', { infer: true }) === 'production' && !expected) {
      throw new UnauthorizedException('Metrics token is not configured');
    }
    reply.type('text/plain; version=0.0.4; charset=utf-8');
    return this.metrics.render();
  }
}

function matchesToken(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
