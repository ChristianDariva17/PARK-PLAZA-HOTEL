import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Environment } from './config/environment.js';

export function setupOpenApi(
  app: INestApplication,
  environment: Pick<Environment, 'AUTH_COOKIE_NAME'>,
): void {
  const config = new DocumentBuilder()
    .setTitle('Park Plaza API')
    .setDescription('Authenticated API contract for Park Plaza hotel operations')
    .setVersion('1.0.0')
    .addCookieAuth(environment.AUTH_COOKIE_NAME)
    .addGlobalResponse({ status: 400, description: 'Invalid request payload' })
    .addGlobalResponse({ status: 401, description: 'Authentication required' })
    .addGlobalResponse({ status: 403, description: 'Insufficient permissions' })
    .addGlobalResponse({ status: 409, description: 'Domain or idempotency conflict' })
    .addGlobalResponse({ status: 500, description: 'Internal server error' })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    autoTagControllers: true,
  });

  // Keep the contract available for CI and local verification without exposing Swagger UI in production.
  SwaggerModule.setup('docs', app, document, {
    ui: false,
    raw: ['json'],
    useGlobalPrefix: true,
  });
}
