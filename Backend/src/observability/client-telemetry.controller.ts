import { BadRequestException, Body, Controller, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { MetricsService } from './metrics.service.js';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const KINDS = new Set(['request', 'websocket', 'chunk', 'performance']);
const OUTCOMES = new Set(['failure', 'connected', 'disconnected', 'error', 'measured']);
const METRICS = new Set(['lcp', 'inp', 'cls']);
const ROUTE_PATTERN = /^\/(?:api\/[a-z0-9_.-]+|[a-z0-9_.-]+)?$/i;

interface ClientTelemetryEvent {
  kind: string;
  outcome: string;
  method: string;
  route: string;
  statusCode: number | null;
  attempt: number;
  requestId: string | null;
  metric: string | null;
  value: number | null;
}

@Public()
@Controller('observability')
export class ClientTelemetryController {
  private readonly logger = new Logger(ClientTelemetryController.name);

  constructor(private readonly metrics: MetricsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('client-events')
  record(@Body() body: unknown): { accepted: true } {
    const event = parseClientTelemetryEvent(body);
    this.metrics.observeClientEvent(event.kind, event.outcome, event.statusCode);
    if (event.kind === 'request' && event.attempt > 0) this.metrics.recordClientRetry();
    if (event.kind === 'performance' && event.metric && event.value !== null) this.metrics.observeClientWebVital(event.metric, event.route, event.value);
    if (event.requestId) this.logger.debug(JSON.stringify({ event: 'client.telemetry', ...event }));
    return { accepted: true };
  }
}

function parseClientTelemetryEvent(body: unknown): ClientTelemetryEvent {
  if (!body || typeof body !== 'object') throw new BadRequestException('Invalid client telemetry event');
  const value = body as Record<string, unknown>;
  const kind = typeof value.kind === 'string' ? value.kind : '';
  const outcome = typeof value.outcome === 'string' ? value.outcome : '';
  const method = typeof value.method === 'string' ? value.method : 'GET';
  const route = typeof value.route === 'string' ? value.route : '';
  const statusCode: number | null = value.statusCode === null || value.statusCode === undefined
    ? null
    : typeof value.statusCode === 'number' ? value.statusCode : Number.NaN;
  const attempt = value.attempt === undefined ? 0 : typeof value.attempt === 'number' ? value.attempt : Number.NaN;
  const requestId = typeof value.requestId === 'string' && /^[A-Za-z0-9._:-]{1,100}$/.test(value.requestId) ? value.requestId : null;
  const metric = typeof value.metric === 'string' ? value.metric : null;
  const sampleValue: number | null = value.value === null || value.value === undefined
    ? null
    : typeof value.value === 'number' ? value.value : Number.NaN;

  if (!KINDS.has(kind) || !OUTCOMES.has(outcome) || !METHODS.has(method) || !ROUTE_PATTERN.test(route)) {
    throw new BadRequestException('Invalid client telemetry event');
  }
  if (statusCode !== null && (!Number.isInteger(statusCode) || statusCode < 0 || statusCode > 599)) {
    throw new BadRequestException('Invalid client telemetry status');
  }
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 1) {
    throw new BadRequestException('Invalid client telemetry attempt');
  }
  if (kind === 'performance') {
    const validValue = sampleValue !== null && Number.isFinite(sampleValue) && sampleValue >= 0
      && sampleValue <= (metric === 'cls' ? 10 : 60_000);
    if (outcome !== 'measured' || method !== 'GET' || statusCode !== null || attempt !== 0 || !metric || !METRICS.has(metric) || !validValue) {
      throw new BadRequestException('Invalid client telemetry measurement');
    }
  } else if (metric !== null || sampleValue !== null) {
    throw new BadRequestException('Invalid client telemetry measurement');
  }

  return { kind, outcome, method, route, statusCode, attempt, requestId, metric, value: sampleValue };
}
