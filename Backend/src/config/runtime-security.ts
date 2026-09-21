import type { Environment } from './environment.js';

type RuntimeSecurityEnvironment = Pick<Environment, 'NODE_ENV' | 'API_REPLICA_MODE' | 'REDIS_URL' | 'REDIS_TLS' | 'REDIS_TLS_REQUIRED' | 'METRICS_TOKEN' | 'DATABASE_SSL' | 'DATABASE_SSL_REQUIRED'>;

export function assertRuntimeSecurity(env: RuntimeSecurityEnvironment): void {
  const violations: string[] = [];

  if (env.API_REPLICA_MODE === 'shared' && !env.REDIS_URL) {
    violations.push('REDIS_URL is required when API_REPLICA_MODE=shared');
  }
  if (env.API_REPLICA_MODE === 'shared' && env.REDIS_URL) {
    let protocol: string;
    try {
      protocol = new URL(env.REDIS_URL).protocol;
    } catch {
      protocol = 'invalid:';
    }
    if (protocol !== 'redis:' && protocol !== 'rediss:') {
      violations.push('REDIS_URL must use redis:// or rediss://');
    } else if ((protocol === 'rediss:') !== env.REDIS_TLS) {
      violations.push('REDIS_TLS must match the REDIS_URL scheme');
    }
    if (env.NODE_ENV === 'production' && env.REDIS_TLS_REQUIRED && !env.REDIS_TLS) {
      violations.push('REDIS_TLS=true is required for production shared Redis');
    }
  }
  if (env.NODE_ENV === 'production' && !env.METRICS_TOKEN) {
    violations.push('METRICS_TOKEN is required when NODE_ENV=production');
  }
  if (env.NODE_ENV === 'production' && env.DATABASE_SSL_REQUIRED && !env.DATABASE_SSL) {
    violations.push('DATABASE_SSL=true is required when DATABASE_SSL_REQUIRED=true');
  }

  if (violations.length > 0) {
    throw new Error(`Invalid runtime security configuration: ${violations.join('; ')}`);
  }
}
