CREATE TABLE IF NOT EXISTS "command_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "operation" varchar(96) NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "request_fingerprint" varchar(64) NOT NULL,
  "response_status" integer DEFAULT 200 NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "command_receipts_property_operation_key_unique"
  ON "command_receipts" USING btree ("property_id", "operation", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "command_receipts_created_at_idx"
  ON "command_receipts" USING btree ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid REFERENCES "properties"("id") ON DELETE RESTRICT,
  "event_type" varchar(100) NOT NULL,
  "aggregate_type" varchar(64),
  "aggregate_id" varchar(128),
  "payload" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "processed_at" timestamp with time zone,
  "last_error" varchar(1000),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_dispatch_idx"
  ON "outbox_events" USING btree ("status", "available_at", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_property_idx"
  ON "outbox_events" USING btree ("property_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_qr_nonces" (
  "nonce" uuid PRIMARY KEY NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "issued_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_qr_nonces_expiry_idx"
  ON "attendance_qr_nonces" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_qr_nonces_property_idx"
  ON "attendance_qr_nonces" USING btree ("property_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "experience_participations_property_idempotency_unique"
  ON "experience_participations" USING btree ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_participations_slot_idx"
  ON "experience_participations" USING btree ("property_id", "experience_id", "scheduled_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchase_orders_property_order_number"
  ON "purchase_orders" USING btree ("property_id", "order_number");
--> statement-breakpoint
DO $$
DECLARE
  constraint_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM suppliers s
    WHERE s.archived_by_account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = s.archived_by_account_id)
  ) THEN
    RAISE EXCEPTION 'Supplier archive data references accounts that do not exist';
  END IF;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    WHERE rel.relname = 'suppliers'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) LIKE '%customer_accounts%'
  LOOP
    EXECUTE format('ALTER TABLE suppliers DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_archived_by_account_id_accounts_id_fk') THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_archived_by_account_id_accounts_id_fk
      FOREIGN KEY (archived_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_id_property_id_unique') THEN
    ALTER TABLE events ADD CONSTRAINT events_id_property_id_unique UNIQUE (id, property_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_spaces_id_property_id_unique') THEN
    ALTER TABLE event_spaces ADD CONSTRAINT event_spaces_id_property_id_unique UNIQUE (id, property_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_space_property_fkey') THEN
    ALTER TABLE events ADD CONSTRAINT events_space_property_fkey
      FOREIGN KEY (space_id, property_id) REFERENCES event_spaces(id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_guest_property_fkey') THEN
    ALTER TABLE events ADD CONSTRAINT events_guest_property_fkey
      FOREIGN KEY (guest_id, property_id) REFERENCES guests(id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_created_by_property_fkey') THEN
    ALTER TABLE events ADD CONSTRAINT events_created_by_property_fkey
      FOREIGN KEY (created_by_account_id, property_id) REFERENCES accounts(id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_cancelled_by_property_fkey') THEN
    ALTER TABLE events ADD CONSTRAINT events_cancelled_by_property_fkey
      FOREIGN KEY (cancelled_by_account_id, property_id) REFERENCES accounts(id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_services_event_property_fkey') THEN
    ALTER TABLE event_services ADD CONSTRAINT event_services_event_property_fkey
      FOREIGN KEY (event_id, property_id) REFERENCES events(id, property_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_space_services_space_property_fkey') THEN
    ALTER TABLE event_space_services ADD CONSTRAINT event_space_services_space_property_fkey
      FOREIGN KEY (space_id, property_id) REFERENCES event_spaces(id, property_id) ON DELETE CASCADE;
  END IF;
END $$;
