import 'dotenv/config';
import pg from 'pg';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';

const env = validateEnv(process.env);
const pool = new pg.Pool({
  connectionString: databaseUrlFromEnv(env),
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES properties(id),
        legal_name text NOT NULL,
        legal_name_normalized text NOT NULL,
        tax_id varchar(50) NOT NULL,
        tax_id_normalized varchar(50) NOT NULL,
        trade_name text,
        contact_name text,
        phone varchar(50),
        email text,
        categories text[],
        average_delivery_days integer DEFAULT 0,
        is_preferred boolean DEFAULT false NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        version integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        archived_at timestamp,
        archived_by_account_id uuid REFERENCES customer_accounts(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_property_isolation ON suppliers(id, property_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_tax_id_active ON suppliers(property_id, tax_id_normalized) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_suppliers_list ON suppliers(property_id, status, legal_name_normalized);

      CREATE TABLE IF NOT EXISTS supplier_bank_details (
        supplier_id uuid PRIMARY KEY REFERENCES suppliers(id) ON DELETE CASCADE,
        property_id uuid NOT NULL REFERENCES properties(id),
        bank_name text,
        account_type varchar(50),
        account_holder text,
        masked_account_number varchar(10),
        encrypted_payload text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS supplier_commands (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id uuid NOT NULL REFERENCES properties(id),
        operation varchar(50) NOT NULL,
        idempotency_key uuid NOT NULL,
        request_fingerprint text NOT NULL,
        response_status integer,
        response text,
        created_at timestamp NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_commands_unique ON supplier_commands(property_id, operation, idempotency_key);
    `);
    console.log('Suppliers tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
