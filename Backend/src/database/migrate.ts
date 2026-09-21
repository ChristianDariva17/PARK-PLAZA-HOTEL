import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { validateEnv } from '../config/environment.js';
import { postgresPoolOptions } from './connection-options.js';

const env = validateEnv(process.env);
const pool = new Pool(postgresPoolOptions(env, { max: 1 }));

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  const result = await pool.query<{ version: string }>(
    `select version from schema_sentinels where key = 'application_schema' limit 1`,
  );
  if (result.rows[0]?.version !== env.DATABASE_SCHEMA_VERSION) {
    throw new Error(`Database schema sentinel is not at ${env.DATABASE_SCHEMA_VERSION}`);
  }
} finally {
  await pool.end();
}
