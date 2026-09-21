import { Inject, Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.module.js';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly httpRequests = new Counter({
    name: 'park_plaza_http_requests_total',
    help: 'Total HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: 'park_plaza_http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly commandConflicts = new Counter({
    name: 'park_plaza_command_conflicts_total',
    help: 'Total HTTP conflict responses, including idempotency conflicts.',
    labelNames: ['method', 'route'],
    registers: [this.registry],
  });
  private readonly outboxEvents = new Counter({
    name: 'park_plaza_outbox_events_total',
    help: 'Total outbox dispatch outcomes.',
    labelNames: ['status'],
    registers: [this.registry],
  });
  private readonly outboxPending = new Gauge({
    name: 'park_plaza_outbox_pending',
    help: 'Current number of pending outbox events.',
    registers: [this.registry],
  });
  private readonly outboxProcessing = new Gauge({
    name: 'park_plaza_outbox_processing',
    help: 'Current number of processing outbox events.',
    registers: [this.registry],
  });
  private readonly outboxDeadLetter = new Gauge({
    name: 'park_plaza_outbox_dead_letter',
    help: 'Current number of dead-letter outbox events.',
    registers: [this.registry],
  });
  private readonly outboxOldestAge = new Gauge({
    name: 'park_plaza_outbox_oldest_age_seconds',
    help: 'Age of the oldest pending outbox event in seconds.',
    registers: [this.registry],
  });
  private readonly realtimeConnections = new Gauge({
    name: 'park_plaza_realtime_connections',
    help: 'Current authenticated realtime connections.',
    registers: [this.registry],
  });
  private readonly clientEvents = new Counter({
    name: 'park_plaza_client_events_total',
    help: 'Sanitized browser observability events.',
    labelNames: ['kind', 'outcome', 'status_code'],
    registers: [this.registry],
  });
  private readonly clientRetries = new Counter({
    name: 'park_plaza_client_retries_total',
    help: 'Browser requests that completed after a retry.',
    registers: [this.registry],
  });
  private readonly clientWebVitals = new Histogram({
    name: 'park_plaza_client_web_vitals',
    help: 'Sanitized browser Web Vital measurements. LCP and INP are milliseconds; CLS is unitless.',
    labelNames: ['metric', 'route'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 4, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 4_000, 10_000, 60_000],
    registers: [this.registry],
  });
  private readonly poolTotal = new Gauge({
    name: 'park_plaza_database_pool_total',
    help: 'Total PostgreSQL pool clients.',
    registers: [this.registry],
  });
  private readonly poolIdle = new Gauge({
    name: 'park_plaza_database_pool_idle',
    help: 'Idle PostgreSQL pool clients.',
    registers: [this.registry],
  });
  private readonly poolWaiting = new Gauge({
    name: 'park_plaza_database_pool_waiting',
    help: 'Requests waiting for a PostgreSQL pool client.',
    registers: [this.registry],
  });

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    collectDefaultMetrics({ register: this.registry, prefix: 'park_plaza_nodejs_' });
  }

  observeHttp(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationMs / 1_000);
    if (statusCode === 409) this.commandConflicts.inc({ method, route });
  }

  recordOutbox(status: 'sent' | 'retry' | 'dead_letter' | 'requeued'): void {
    this.outboxEvents.inc({ status });
  }

  setOutboxBacklog(pending: number, processing: number, deadLetter: number, oldestAgeSeconds: number): void {
    this.outboxPending.set(pending);
    this.outboxProcessing.set(processing);
    this.outboxDeadLetter.set(deadLetter);
    this.outboxOldestAge.set(oldestAgeSeconds);
  }

  connectionOpened(): void {
    this.realtimeConnections.inc();
  }

  connectionClosed(): void {
    this.realtimeConnections.dec();
  }

  observeClientEvent(kind: string, outcome: string, statusCode: number | null): void {
    this.clientEvents.inc({ kind, outcome, status_code: statusCode === null ? 'none' : String(statusCode) });
  }

  recordClientRetry(): void {
    this.clientRetries.inc();
  }

  observeClientWebVital(metric: string, route: string, value: number): void {
    this.clientWebVitals.observe({ metric, route }, value);
  }

  render(): Promise<string> {
    this.poolTotal.set(this.pool.totalCount);
    this.poolIdle.set(this.pool.idleCount);
    this.poolWaiting.set(this.pool.waitingCount);
    return this.registry.metrics();
  }
}
