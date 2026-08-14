import 'dotenv/config';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { databaseUrlFromEnv, validateEnv } from '../src/config/environment.js';

const env = validateEnv({ ...process.env, DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '5433' });
const pool = new Pool({ connectionString: databaseUrlFromEnv(env), max: 1 });
afterAll(() => pool.end());

describe('PostgreSQL readiness', () => {
  it('has the migrated schema and overlap constraint', async () => {
    const result = await pool.query<{ schema_ready: boolean; constraint_ready: boolean; security_ready: boolean; audit_guard_ready: boolean; session_guard_ready: boolean; system_roles_ready: boolean }>(`select
      to_regclass('public.reservations') is not null as schema_ready,
      exists (select 1 from pg_constraint where conname = 'reservations_no_active_overlap') as constraint_ready,
      to_regclass('public.sessions') is not null and to_regclass('public.role_permissions') is not null as security_ready,
      (select count(*) = 2 from pg_trigger where tgname in ('audit_events_append_only', 'audit_events_no_truncate') and not tgisinternal) as audit_guard_ready,
      exists (select 1 from pg_indexes where indexname = 'sessions_one_active_per_account' and indexdef like '%WHERE (revoked_at IS NULL)%') as session_guard_ready,
      (select array_agg(key order by key) = array['administrator','cleaning','kitchen','receptionist']::varchar[] from roles where is_system) as system_roles_ready`);
    expect(result.rows[0]).toEqual({ schema_ready: true, constraint_ready: true, security_ready: true, audit_guard_ready: true, session_guard_ready: true, system_roles_ready: true });
  });
});
