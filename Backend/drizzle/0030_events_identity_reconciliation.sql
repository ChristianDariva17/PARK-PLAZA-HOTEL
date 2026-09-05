DO $$ BEGIN
  CREATE TYPE "public"."event_legacy_party" AS ENUM('guest', 'customerAccount', 'both', 'neither');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."event_quarantine_status" AS ENUM('pending', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "legacy_party_type" "event_legacy_party",
  ADD COLUMN IF NOT EXISTS "quarantine_status" "event_quarantine_status" DEFAULT 'resolved' NOT NULL,
  ADD COLUMN IF NOT EXISTS "quarantine_resolved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "quarantine_resolved_by_account_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_quarantine_resolved_by_account_id_accounts_id_fk"
    FOREIGN KEY ("quarantine_resolved_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "chk_canonical_party"
    CHECK ("quarantine_status" = 'pending' OR (("guest_id" IS NOT NULL AND "customer_account_id" IS NULL) OR ("guest_id" IS NULL AND "customer_account_id" IS NOT NULL)));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
