import 'dotenv/config';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { Logger, ValidationPipe, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { setupOpenApi } from './openapi.js';
import { AppModule } from './app.module.js';
import { validateEnv, type Environment } from './config/environment.js';
import { HttpExceptionFilter } from './http/http-exception.filter.js';
import { MetricsService } from './observability/metrics.service.js';
import { assertRuntimeSecurity } from './config/runtime-security.js';
import { RedisService } from './infrastructure/redis.service.js';

function requestRoute(request: any): string {
  if (typeof request.routeOptions?.url === 'string') return request.routeOptions.url;
  try {
    return new URL(request.url, 'http://localhost').pathname;
  } catch {
    return 'unknown';
  }
}

async function bootstrap(): Promise<void> {
  const environment = validateEnv(process.env);
  assertRuntimeSecurity(environment);
  const trustProxy = environment.API_TRUST_PROXY_HOPS === 0
    ? false
    : (_address: string, hop: number) => hop < environment.API_TRUST_PROXY_HOPS;
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy, bodyLimit: 5 * 1024 * 1024 }));
  await app.get(RedisService).connect();
  const logger = new Logger('HttpMetrics');
  const metrics = app.get(MetricsService);
  const startedAt = new WeakMap<object, number>();
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request: object, _reply: unknown, done: () => void) => {
    startedAt.set(request, performance.now());
    done();
  });
  fastify.addHook('onResponse', (request: any, reply: any, done: () => void) => {
    const start = startedAt.get(request);
    const route = requestRoute(request);
    logger.log(JSON.stringify({
      event: 'http.request',
      requestId: request.id,
      method: request.method,
      route,
      statusCode: reply.statusCode,
      durationMs: start === undefined ? undefined : Math.round(performance.now() - start),
    }));
    metrics.observeHttp(
      request.method,
      route,
      reply.statusCode,
      start === undefined ? 0 : performance.now() - start,
    );
    done();
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.register(helmet);
  await app.register(cookie);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: ['1', VERSION_NEUTRAL] });
  if (environment.NODE_ENV !== 'production') setupOpenApi(app, environment);
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const origins = config.get('CORS_ALLOWED_ORIGINS', { infer: true });
    if (origins.length) app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  }
  await app.listen({ host: config.get('API_HOST', { infer: true }), port: config.get('API_PORT', { infer: true }) });
}

void bootstrap();
