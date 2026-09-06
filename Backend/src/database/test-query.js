import 'dotenv/config';
import pg from 'pg';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';

const env = validateEnv(process.env);
const pool = new pg.Pool({
  connectionString: databaseUrlFromEnv(env),
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});

async function main() {
  try {
    const res = await pool.query(
      'select "id", "property_id", "reservation_id", "reference", "status", "created_at", "updated_at" from "contracts" where "contracts"."property_id" = $1 order by "contracts"."created_at" desc limit $2',
      ['709c9100-9382-4a14-a22e-7c00aa54b185', 50]
    );
    console.log('Postgres Query Success! Rows count:', res.rows.length);
  } catch (err) {
    console.error('Postgres error:', err);
  } finally {
    await pool.end();
  }
}

main();
