ALTER TABLE "reservations" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "status_reason" text;--> statement-breakpoint
CREATE TABLE "reservation_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "property_id" uuid NOT NULL, "reservation_id" uuid NOT NULL,
  "operation" varchar(24) NOT NULL, "idempotency_key" uuid NOT NULL, "fingerprint" varchar(64) NOT NULL, "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "reservation_commands_property_key_unique" UNIQUE("property_id", "idempotency_key")
);--> statement-breakpoint
ALTER TABLE "reservation_commands" ADD CONSTRAINT "reservation_commands_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "reservation_commands" ADD CONSTRAINT "reservation_commands_reservation_property_fkey" FOREIGN KEY ("reservation_id", "property_id") REFERENCES "reservations"("id", "property_id") ON DELETE cascade;--> statement-breakpoint
CREATE INDEX "reservation_commands_reservation_idx" ON "reservation_commands" ("reservation_id", "created_at");
