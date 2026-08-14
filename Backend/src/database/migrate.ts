import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';

const env = validateEnv(process.env);
const pool = new Pool({ connectionString: databaseUrlFromEnv(env), ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false, max: 1 });

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
} finally {
  await pool.end();
}
