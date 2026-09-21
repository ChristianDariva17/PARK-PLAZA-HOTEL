import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Environment } from '../config/environment.js';
import { safeErrorFields } from '../observability/safe-error.js';
import { postgresPoolOptions } from './connection-options.js';
import * as schema from './schema/index.js';

export const DATABASE = Symbol('DATABASE');
export const DATABASE_POOL = Symbol('DATABASE_POOL');
export type Database = NodePgDatabase<typeof schema>;

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown(): Promise<void> { await this.pool.end(); }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        const pool = new Pool(postgresPoolOptions({
          POSTGRES_DB: config.get('POSTGRES_DB', { infer: true }),
          POSTGRES_USER: config.get('POSTGRES_USER', { infer: true }),
          POSTGRES_PASSWORD: config.get('POSTGRES_PASSWORD', { infer: true }),
          DATABASE_HOST: config.get('DATABASE_HOST', { infer: true }),
          DATABASE_PORT: config.get('DATABASE_PORT', { infer: true }),
          DATABASE_SSL: config.get('DATABASE_SSL', { infer: true }),
          DATABASE_SSL_REJECT_UNAUTHORIZED: config.get('DATABASE_SSL_REJECT_UNAUTHORIZED', { infer: true }),
          DATABASE_SSL_CA: config.get('DATABASE_SSL_CA', { infer: true }),
          DATABASE_SSL_CA_FILE: config.get('DATABASE_SSL_CA_FILE', { infer: true }),
          DATABASE_POOL_MAX: config.get('DATABASE_POOL_MAX', { infer: true }),
          DATABASE_CONNECTION_TIMEOUT_MS: config.get('DATABASE_CONNECTION_TIMEOUT_MS', { infer: true }),
          DATABASE_IDLE_TIMEOUT_MS: config.get('DATABASE_IDLE_TIMEOUT_MS', { infer: true }),
          DATABASE_STATEMENT_TIMEOUT_MS: config.get('DATABASE_STATEMENT_TIMEOUT_MS', { infer: true }),
        }));
        const logger = new Logger('DatabasePool');
         pool.on('error', (error: Error) => logger.error(JSON.stringify({ event: 'database.pool_error', ...safeErrorFields(error) })));
        return pool;
      },
    },
    { provide: DATABASE, inject: [DATABASE_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
    DatabaseLifecycle,
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule {}
