import type { PoolConfig } from 'pg';
import { databaseUrlFromEnv, type Environment } from '../config/environment.js';
import { resolveTlsCa } from '../config/tls-material.js';

export type DatabaseEnvironment = Pick<Environment,
  | 'POSTGRES_DB'
  | 'POSTGRES_USER'
  | 'POSTGRES_PASSWORD'
  | 'DATABASE_HOST'
  | 'DATABASE_PORT'
  | 'DATABASE_SSL'
  | 'DATABASE_SSL_REJECT_UNAUTHORIZED'
  | 'DATABASE_SSL_CA'
  | 'DATABASE_SSL_CA_FILE'
  | 'DATABASE_POOL_MAX'
  | 'DATABASE_CONNECTION_TIMEOUT_MS'
  | 'DATABASE_IDLE_TIMEOUT_MS'
  | 'DATABASE_STATEMENT_TIMEOUT_MS'
>;

export function databaseSslFromEnv(env: DatabaseEnvironment): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!env.DATABASE_SSL) return false;
  const ca = resolveTlsCa(env.DATABASE_SSL_CA, env.DATABASE_SSL_CA_FILE);

  return {
    rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED,
    ...(ca ? { ca } : {}),
  };
}

export function postgresPoolOptions(env: DatabaseEnvironment, overrides: Partial<PoolConfig> = {}): PoolConfig {
  return {
    // Keep TLS options explicit; pg's sslmode URL parser can override the CA.
    connectionString: databaseUrlFromEnv({ ...env, DATABASE_SSL: false }),
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
    statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
    ssl: databaseSslFromEnv(env),
    ...overrides,
  };
}
