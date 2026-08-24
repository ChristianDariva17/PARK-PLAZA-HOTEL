CREATE TYPE "receivable_status" AS ENUM ('open', 'settled');--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD COLUMN "opened_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_owner_property_fkey" FOREIGN KEY ("opened_by_account_id","property_id") REFERENCES "accounts"("id","property_id") ON DELETE restrict;--> statement-breakpoint
CREATE TABLE "receivables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "property_id" uuid NOT NULL, "stay_id" uuid NOT NULL UNIQUE, "reservation_id" uuid NOT NULL, "primary_guest_id" uuid NOT NULL, "folio_id" uuid NOT NULL UNIQUE,
  "status" "receivable_status" DEFAULT 'open' NOT NULL, "original_amount" numeric(14,2) NOT NULL, "outstanding_amount" numeric(14,2) NOT NULL, "reason" varchar(300) NOT NULL, "opened_at" timestamp with time zone DEFAULT now() NOT NULL, "settled_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "receivables_amounts_check" CHECK ("original_amount" > 0 AND "outstanding_amount" >= 0 AND "outstanding_amount" <= "original_amount")
);--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_stay_property_fkey" FOREIGN KEY ("stay_id","property_id") REFERENCES "stays"("id","property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_reservation_property_fkey" FOREIGN KEY ("reservation_id","property_id") REFERENCES "reservations"("id","property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_guest_property_fkey" FOREIGN KEY ("primary_guest_id","property_id") REFERENCES "guests"("id","property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_folio_property_fkey" FOREIGN KEY ("folio_id","property_id") REFERENCES "folios"("id","property_id") ON DELETE restrict;--> statement-breakpoint
CREATE INDEX "receivables_property_status_opened_idx" ON "receivables" ("property_id","status","opened_at");--> statement-breakpoint
CREATE TABLE "receivable_commands" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "property_id" uuid NOT NULL, "operation" varchar(48) NOT NULL, "idempotency_key" uuid NOT NULL, "response" jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "receivable_commands_property_operation_idempotency_key_unique" UNIQUE("property_id","operation","idempotency_key"));--> statement-breakpoint
ALTER TABLE "receivable_commands" ADD CONSTRAINT "receivable_commands_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES ('finance.read', 'Read property receivables'), ('finance.payment', 'Collect property receivables'), ('finance.reverse', 'Reverse receivable collections') ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "receivables" ("property_id", "stay_id", "reservation_id", "primary_guest_id", "folio_id", "status", "original_amount", "outstanding_amount", "reason", "opened_at")
SELECT s.property_id, s.id, s.reservation_id, r.primary_guest_id, f.id, 'open', balances.amount, balances.amount, COALESCE(s.receivable_reason, 'Legacy receivable'), COALESCE(s.check_out_at, now())
FROM stays s JOIN reservations r ON r.id = s.reservation_id AND r.property_id = s.property_id JOIN folios f ON f.stay_id = s.id AND f.property_id = s.property_id
JOIN LATERAL (SELECT COALESCE(SUM(CASE WHEN e.type = 'charge' THEN e.amount WHEN e.type = 'payment' THEN -e.amount WHEN e.type = 'reversal' AND original.type = 'payment' THEN e.amount ELSE -e.amount END), 0)::numeric(14,2) AS amount FROM folio_entries e LEFT JOIN folio_entries original ON original.id = e.reversal_of_entry_id WHERE e.folio_id = f.id AND e.property_id = s.property_id) balances ON true
WHERE s.status = 'checked_out' AND s.settlement = 'receivable' AND balances.amount > 0
ON CONFLICT ("stay_id") DO NOTHING;
