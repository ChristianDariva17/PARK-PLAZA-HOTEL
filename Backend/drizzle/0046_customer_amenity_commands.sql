CREATE TABLE IF NOT EXISTS "customer_amenity_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "customer_account_id" uuid NOT NULL,
  "amenity_reservation_id" uuid NOT NULL,
  "idempotency_key" uuid NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_amenity_commands_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict,
  CONSTRAINT "customer_amenity_commands_customer_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE restrict,
  CONSTRAINT "customer_amenity_commands_reservation_fkey" FOREIGN KEY ("amenity_reservation_id") REFERENCES "amenity_reservations"("id") ON DELETE cascade,
  CONSTRAINT "customer_amenity_commands_customer_key_unique" UNIQUE ("customer_account_id", "idempotency_key")
);
CREATE INDEX IF NOT EXISTS "customer_amenity_commands_reservation_idx" ON "customer_amenity_commands" ("amenity_reservation_id", "created_at");
