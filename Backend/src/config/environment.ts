import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');
const secureBooleanString = z.enum(['true', 'false']).default('true').transform((value) => value === 'true');
const csv = z.string().default('').transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean));

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  API_REPLICA_MODE: z.enum(['single', 'shared']).default('single'),
  REDIS_URL: z.string().url().optional(),
  REDIS_TLS: booleanString,
  REDIS_TLS_REQUIRED: secureBooleanString,
  REDIS_TLS_CA: z.string().min(1).optional(),
  REDIS_TLS_CA_FILE: z.string().min(1).optional(),
  METRICS_TOKEN: z.string().min(32).optional(),
  POSTGRES_DB: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(16),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DATABASE_SSL: booleanString,
  DATABASE_SSL_REQUIRED: secureBooleanString,
  DATABASE_SSL_REJECT_UNAUTHORIZED: secureBooleanString,
  DATABASE_SSL_CA: z.string().min(1).optional(),
  DATABASE_SSL_CA_FILE: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(5000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(10000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
  DATABASE_SCHEMA_VERSION: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/).default('0059_event_space_service_metadata'),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(8),
  OUTBOX_RETRY_BASE_MS: z.coerce.number().int().min(100).max(600000).default(1000),
  OUTBOX_RETRY_MAX_MS: z.coerce.number().int().min(1000).max(3600000).default(300000),
  OUTBOX_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  OUTBOX_DISPATCH_LIMIT: z.coerce.number().int().min(1).max(500).default(50),
  CORS_ALLOWED_ORIGINS: csv,
  AUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('pp_session'),
  CUSTOMER_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('customer_session'),
  AUTH_SESSION_MAX_HOURS: z.coerce.number().int().min(1).max(8).default(8),
  AUTH_SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).max(30).default(30),
  AUTH_LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).max(100).default(5),
  AUTH_LOGIN_BASE_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(250),
  AUTH_LOGIN_MAX_DELAY_MS: z.coerce.number().int().min(0).max(60000).default(4000),
  AUTH_LOGIN_LOCK_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  AUTH_LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  ATTENDANCE_QR_SECRET: z.string().min(32),
  BIOMETRIC_BRIDGE_CAPABILITY_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_REGISTRATION_PROPERTY_ID: z.string().uuid().optional(),
  CUSTOMER_PORTAL_PROPERTY_ID: z.string().uuid(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  CUSTOMER_SESSION_MAX_DAYS: z.coerce.number().int().min(1).default(30),
  CUSTOMER_SESSION_IDLE_HOURS: z.coerce.number().int().min(1).default(24),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnv(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment: ${z.prettifyError(result.error)}`);
  return result.data;
}

export function databaseUrlFromEnv(env: Pick<Environment, 'POSTGRES_USER' | 'POSTGRES_PASSWORD' | 'DATABASE_HOST' | 'DATABASE_PORT' | 'POSTGRES_DB' | 'DATABASE_SSL'>): string {
  const user = encodeURIComponent(env.POSTGRES_USER);
  const password = encodeURIComponent(env.POSTGRES_PASSWORD);
  const sslMode = env.DATABASE_SSL ? '?sslmode=require' : '';
  return `postgresql://${user}:${password}@${env.DATABASE_HOST}:${env.DATABASE_PORT}/${env.POSTGRES_DB}${sslMode}`;
}
