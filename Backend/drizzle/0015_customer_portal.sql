CREATE TYPE "customer_account_status" AS ENUM ('active', 'disabled');--> statement-breakpoint
CREATE TABLE "customer_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firebase_subject" varchar(128) NOT NULL,
  "email" varchar(254) NOT NULL,
  "display_name" varchar(200),
  "photo_url" varchar(2048),
  "status" "customer_account_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_accounts_firebase_subject_unique" UNIQUE("firebase_subject")
);--> statement-breakpoint
CREATE TABLE "customer_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "customer_account_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revocation_reason" varchar(32),
  "ip_address" varchar(64),
  "user_agent" varchar(512),
  CONSTRAINT "customer_sessions_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE TABLE "customer_guest_identities" (
  "customer_account_id" uuid PRIMARY KEY NOT NULL,
  "guest_id" uuid NOT NULL,
  "property_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_guest_identities_guest_property_unique" UNIQUE("guest_id", "property_id")
);--> statement-breakpoint
CREATE TABLE "customer_reservations" (
  "reservation_id" uuid PRIMARY KEY NOT NULL,
  "property_id" uuid NOT NULL,
  "customer_account_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "customer_reservation_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "customer_account_id" uuid NOT NULL,
  "reservation_id" uuid NOT NULL,
  "idempotency_key" uuid NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "customer_reservation_commands_customer_key_unique" UNIQUE("customer_account_id", "idempotency_key")
);--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "customer_guest_identities" ADD CONSTRAINT "customer_guest_identities_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "customer_guest_identities" ADD CONSTRAINT "customer_guest_identities_guest_property_fkey" FOREIGN KEY ("guest_id", "property_id") REFERENCES "guests"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_guest_identities" ADD CONSTRAINT "customer_guest_identities_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_reservation_property_fkey" FOREIGN KEY ("reservation_id", "property_id") REFERENCES "reservations"("id", "property_id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_reservations" ADD CONSTRAINT "customer_reservations_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_reservation_commands" ADD CONSTRAINT "customer_reservation_commands_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_reservation_commands" ADD CONSTRAINT "customer_reservation_commands_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "customer_reservation_commands" ADD CONSTRAINT "customer_reservation_commands_reservation_property_fkey" FOREIGN KEY ("reservation_id", "property_id") REFERENCES "reservations"("id", "property_id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "customer_accounts_email_idx" ON "customer_accounts" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_sessions_one_active_per_account" ON "customer_sessions" ("customer_account_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "customer_sessions_token_lookup_idx" ON "customer_sessions" ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_reservations_owner_idx" ON "customer_reservations" ("customer_account_id", "created_at");--> statement-breakpoint
CREATE INDEX "customer_reservation_commands_reservation_idx" ON "customer_reservation_commands" ("reservation_id", "created_at");
