import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { databaseUrlFromEnv, validateEnv } from './src/config/environment.js';

const env = validateEnv(process.env);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrlFromEnv(env) },
  migrations: { table: '__drizzle_migrations', schema: 'public' },
  strict: true,
  verbose: true,
});
