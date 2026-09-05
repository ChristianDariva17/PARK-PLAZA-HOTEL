import 'dotenv/config';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { validateEnv, type Environment } from './config/environment.js';
import { HttpExceptionFilter } from './http/http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const environment = validateEnv(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: environment.API_TRUST_PROXY_HOPS, bodyLimit: 5 * 1024 * 1024 }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.register(helmet);
  await app.register(cookie);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Environment, true>);
  app.setGlobalPrefix('api');
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const origins = config.get('CORS_ALLOWED_ORIGINS', { infer: true });
    if (origins.length) app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  }
  await app.listen({ host: config.get('API_HOST', { infer: true }), port: config.get('API_PORT', { infer: true }) });
}

void bootstrap();
