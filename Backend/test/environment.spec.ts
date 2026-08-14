import { describe, expect, it } from 'vitest';
import { databaseUrlFromEnv, validateEnv } from '../src/config/environment.js';
import { ACTIVE_RESERVATION_STATUSES } from '../src/database/schema/reservations.schema.js';

const valid = { POSTGRES_DB: 'park_plaza', POSTGRES_USER: 'api', POSTGRES_PASSWORD: 'a-secure-password', DATABASE_HOST: 'localhost' };

describe('environment', () => {
  it('applies safe defaults and encodes credentials', () => {
    const env = validateEnv(valid);
    expect(env.API_PORT).toBe(3000);
    expect(env.API_TRUST_PROXY_HOPS).toBe(0);
    expect(env.AUTH_LOGIN_MAX_DELAY_MS).toBe(4000);
    expect(databaseUrlFromEnv({ ...env, POSTGRES_PASSWORD: 'safe@password/123' })).toContain('safe%40password%2F123');
  });

  it('rejects weak credentials and invalid database names', () => {
    expect(() => validateEnv({ ...valid, POSTGRES_PASSWORD: 'short' })).toThrow('Invalid environment');
    expect(() => validateEnv({ ...valid, POSTGRES_DB: 'bad-name' })).toThrow('Invalid environment');
  });

  it('keeps the database overlap policy explicit', () => {
    expect(ACTIVE_RESERVATION_STATUSES).toEqual(['pending', 'confirmed', 'checked_in']);
  });
});
