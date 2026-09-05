ALTER TYPE "event_status" ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE "event_status" ADD VALUE IF NOT EXISTS 'in_progress';

ALTER TABLE "event_spaces"
  ADD COLUMN "setup_minutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN "teardown_minutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN "minimum_duration_minutes" integer NOT NULL DEFAULT 60,
  ADD COLUMN "base_rate" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "included_minutes" integer NOT NULL DEFAULT 60,
  ADD COLUMN "extra_minute_rate" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "deposit_percentage" numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "guarantee_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "cleaning_fee" numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "tax_rate" numeric(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "cancellation_policy" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "events"
  ADD COLUMN "event_starts_at" timestamp with time zone,
  ADD COLUMN "event_ends_at" timestamp with time zone,
  ADD COLUMN "expires_at" timestamp with time zone,
  ADD COLUMN "deposit_amount" numeric(12, 2),
  ADD COLUMN "deposit_received_amount" numeric(12, 2),
  ADD COLUMN "balance_amount" numeric(12, 2),
  ADD COLUMN "guarantee_amount" numeric(12, 2),
  ADD COLUMN "pricing_snapshot" jsonb,
  ADD COLUMN "policy_snapshot" jsonb,
  ADD COLUMN "created_by_customer_account_id" uuid REFERENCES "customer_accounts"("id");

ALTER TABLE "events" ALTER COLUMN "created_by_account_id" DROP NOT NULL;
ALTER TABLE "event_services" ADD COLUMN "unit_amount" numeric(12, 2), ADD COLUMN "total_amount" numeric(12, 2);

CREATE TABLE "event_space_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id"),
  "space_id" uuid NOT NULL REFERENCES "event_spaces"("id"),
  "code" varchar(64) NOT NULL,
  "name" varchar(255) NOT NULL,
  "unit_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "idx_event_space_services_code" ON "event_space_services" ("space_id", "code");
CREATE INDEX "idx_events_active_interval" ON "events" ("property_id", "space_id", "starts_at", "ends_at");
