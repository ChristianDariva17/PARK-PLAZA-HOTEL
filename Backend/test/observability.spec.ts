import { describe, expect, it, vi } from 'vitest';
import { MetricsController } from '../src/observability/metrics.controller.js';
import { MetricsService } from '../src/observability/metrics.service.js';
import { ClientTelemetryController } from '../src/observability/client-telemetry.controller.js';

function config(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as any;
}

describe('MetricsService', () => {
  it('renders request and conflict metrics with database pool gauges', async () => {
    const service = new MetricsService({ totalCount: 4, idleCount: 2, waitingCount: 1 } as any);

    service.observeHttp('POST', '/api/reservations', 409, 125);
    service.observeClientWebVital('lcp', '/', 1234);
    service.setOutboxBacklog(3, 1, 2, 45);
    const output = await service.render();

    expect(output).toContain('park_plaza_http_requests_total');
    expect(output).toContain('park_plaza_command_conflicts_total');
    expect(output).toContain('park_plaza_client_web_vitals');
    expect(output).toContain('park_plaza_database_pool_total 4');
    expect(output).toContain('park_plaza_database_pool_idle 2');
    expect(output).toContain('park_plaza_database_pool_waiting 1');
    expect(output).toContain('park_plaza_outbox_pending 3');
    expect(output).toContain('park_plaza_outbox_processing 1');
    expect(output).toContain('park_plaza_outbox_dead_letter 2');
    expect(output).toContain('park_plaza_outbox_oldest_age_seconds 45');
  });
});

describe('MetricsController', () => {
  it('rejects production scrapes without a configured token', async () => {
    const controller = new MetricsController({ render: vi.fn() } as any, config({ NODE_ENV: 'production' }));

    await expect(controller.metricsEndpoint(undefined, undefined, { type: vi.fn() } as any)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('sets the text serializer only after the token is authorized', async () => {
    const reply = { type: vi.fn() };
    const render = vi.fn().mockResolvedValue('metrics');
    const controller = new MetricsController(
      { render } as any,
      config({ NODE_ENV: 'production', METRICS_TOKEN: 'a'.repeat(32) }),
    );

    await expect(controller.metricsEndpoint(undefined, `Bearer ${'a'.repeat(32)}`, reply as any)).resolves.toBe('metrics');

    expect(reply.type).toHaveBeenCalledWith('text/plain; version=0.0.4; charset=utf-8');
    expect(render).toHaveBeenCalledOnce();
  });
});

describe('ClientTelemetryController', () => {
  it('records sanitized client events without accepting identifier-bearing routes', () => {
    const metrics = { observeClientEvent: vi.fn(), recordClientRetry: vi.fn(), observeClientWebVital: vi.fn() } as any;
    const controller = new ClientTelemetryController(metrics);

    expect(controller.record({ kind: 'request', outcome: 'failure', method: 'GET', route: '/api/customers', statusCode: 403, attempt: 1, requestId: 'req-123' })).toEqual({ accepted: true });
    expect(metrics.observeClientEvent).toHaveBeenCalledWith('request', 'failure', 403);
    expect(metrics.recordClientRetry).toHaveBeenCalledOnce();
    expect(controller.record({ kind: 'performance', outcome: 'measured', method: 'GET', route: '/', statusCode: null, attempt: 0, metric: 'lcp', value: 1234 })).toEqual({ accepted: true });
    expect(metrics.observeClientWebVital).toHaveBeenCalledWith('lcp', '/', 1234);
    expect(() => controller.record({ kind: 'request', outcome: 'failure', method: 'GET', route: '/api/customers/guest-1', statusCode: 403, attempt: 0 })).toThrow('Invalid client telemetry event');
    expect(() => controller.record({ kind: 'performance', outcome: 'measured', method: 'GET', route: '/', statusCode: null, attempt: 0, metric: 'cls', value: 11 })).toThrow('Invalid client telemetry measurement');
  });
});
