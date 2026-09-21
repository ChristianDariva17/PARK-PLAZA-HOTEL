import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/config/environment.js';
import { assertRuntimeSecurity } from '../src/config/runtime-security.js';
import { safeErrorFields } from '../src/observability/safe-error.js';

const base = validateEnv({
  POSTGRES_DB: 'park_plaza',
  POSTGRES_USER: 'api',
  POSTGRES_PASSWORD: 'a-secure-password',
  DATABASE_HOST: 'localhost',
  ATTENDANCE_QR_SECRET: 'attendance-qr-test-secret-at-least-32-characters',
  BIOMETRIC_BRIDGE_CAPABILITY_SECRET: 'biometric-bridge-test-secret-at-least-32-characters',
  CUSTOMER_PORTAL_PROPERTY_ID: '11111111-1111-4111-8111-111111111111',
  FIREBASE_PROJECT_ID: 'park-plaza-test',
});

describe('runtime security configuration', () => {
  it('requires a metrics token for production runtime', () => {
    expect(() => assertRuntimeSecurity({ ...base, NODE_ENV: 'production', DATABASE_SSL_REQUIRED: false })).toThrow('METRICS_TOKEN');
    expect(() => assertRuntimeSecurity({ ...base, NODE_ENV: 'production', DATABASE_SSL_REQUIRED: false, METRICS_TOKEN: 'x'.repeat(32) })).not.toThrow();
  });

  it('requires PostgreSQL TLS for production unless explicitly disabled', () => {
    const production = { ...base, NODE_ENV: 'production' as const, METRICS_TOKEN: 'x'.repeat(32) };
    expect(() => assertRuntimeSecurity(production)).toThrow('DATABASE_SSL=true');
    expect(() => assertRuntimeSecurity({ ...production, DATABASE_SSL_REQUIRED: false })).not.toThrow();
    expect(() => assertRuntimeSecurity({ ...production, DATABASE_SSL: true })).not.toThrow();
  });

  it('fails fast when shared runtime has no Redis URL', () => {
    expect(() => assertRuntimeSecurity({ ...base, API_REPLICA_MODE: 'shared' })).toThrow('REDIS_URL');
    expect(() => assertRuntimeSecurity({ ...base, API_REPLICA_MODE: 'shared', REDIS_URL: 'redis://localhost:6379' })).not.toThrow();
  });

  it('requires Redis TLS configuration to match the URL scheme', () => {
    expect(() => assertRuntimeSecurity({ ...base, API_REPLICA_MODE: 'shared', REDIS_URL: 'rediss://localhost:6379' })).toThrow('REDIS_TLS');
    expect(() => assertRuntimeSecurity({ ...base, API_REPLICA_MODE: 'shared', REDIS_URL: 'redis://localhost:6379', REDIS_TLS: true })).toThrow('REDIS_TLS');
    expect(() => assertRuntimeSecurity({ ...base, API_REPLICA_MODE: 'shared', REDIS_URL: 'rediss://localhost:6379', REDIS_TLS: true })).not.toThrow();
  });

  it('requires TLS for production shared Redis unless explicitly disabled', () => {
    const productionShared = { ...base, NODE_ENV: 'production' as const, API_REPLICA_MODE: 'shared' as const, REDIS_URL: 'redis://localhost:6379', METRICS_TOKEN: 'x'.repeat(32), DATABASE_SSL_REQUIRED: false };
    expect(() => assertRuntimeSecurity(productionShared)).toThrow('REDIS_TLS=true');
    expect(() => assertRuntimeSecurity({ ...productionShared, REDIS_TLS_REQUIRED: false })).not.toThrow();
    expect(() => assertRuntimeSecurity({ ...productionShared, REDIS_URL: 'rediss://localhost:6379', REDIS_TLS: true })).not.toThrow();
  });
});

describe('safe error fields', () => {
  it('does not copy exception messages into logs', () => {
    expect(safeErrorFields(new Error('password=secret@example.invalid'))).toEqual({ errorType: 'Error' });
    expect(safeErrorFields({ code: '23505', message: 'sensitive database details' })).toEqual({ errorType: 'object', errorCode: '23505' });
    expect(safeErrorFields({ code: 'password=secret' })).toEqual({ errorType: 'object' });
  });
});
