import 'dotenv/config';
import pg from 'pg';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';

const env = validateEnv(process.env);
const pool = new pg.Pool({
  connectionString: databaseUrlFromEnv(env),
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});

const sql = `
  DO $$ BEGIN
      CREATE TYPE "public"."contract_status" AS ENUM('Borrador', 'Pendiente', 'Vigente', 'Reemplazado', 'Cancelado');
  EXCEPTION
      WHEN duplicate_object THEN null;
  END $$;

  CREATE TABLE IF NOT EXISTS "contracts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict,
    "reservation_id" uuid REFERENCES "public"."reservations"("id") ON DELETE set null,
    "reference" varchar(128) NOT NULL,
    "status" "contract_status" DEFAULT 'Borrador' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "contract_versions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict,
    "contract_id" uuid NOT NULL REFERENCES "public"."contracts"("id") ON DELETE cascade,
    "version_number" varchar(32) NOT NULL,
    "creator_account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE restrict,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "reason" varchar(255) NOT NULL,
    "idempotency_key" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "evidences" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict,
    "origin_type" varchar(64) NOT NULL,
    "origin_id" uuid NOT NULL,
    "description" varchar(255) NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "creator_account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE restrict,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "contract_evidence_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE restrict,
    "contract_id" uuid NOT NULL REFERENCES "public"."contracts"("id") ON DELETE cascade,
    "evidence_id" uuid NOT NULL REFERENCES "public"."evidences"("id") ON DELETE cascade,
    "relation_type" varchar(64) NOT NULL,
    "linked_by_account_id" uuid NOT NULL REFERENCES "public"."accounts"("id") ON DELETE restrict,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  );
`;

async function main() {
  try {
    await pool.query(sql);
    console.log('Contracts & Evidence tables initialized successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await pool.end();
  }
}

main();
