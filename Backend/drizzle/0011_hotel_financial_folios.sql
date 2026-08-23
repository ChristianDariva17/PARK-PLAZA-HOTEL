CREATE TYPE "folio_entry_type" AS ENUM ('charge', 'payment', 'reversal');--> statement-breakpoint
CREATE TYPE "folio_settlement" AS ENUM ('open', 'settled', 'receivable');--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "settlement" "folio_settlement" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "receivable_reason" varchar(300);--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "receivable_amount" numeric(14,2);--> statement-breakpoint
ALTER TABLE "folios" ADD CONSTRAINT "folios_id_property_id_unique" UNIQUE("id","property_id");--> statement-breakpoint
CREATE TABLE "folio_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "property_id" uuid NOT NULL, "folio_id" uuid NOT NULL, "stay_id" uuid NOT NULL,
  "type" "folio_entry_type" NOT NULL, "amount" numeric(14,2) NOT NULL, "payment_method" varchar(20), "source_type" varchar(48) NOT NULL, "source_id" varchar(64) NOT NULL,
  "idempotency_key" uuid NOT NULL, "reversal_of_entry_id" uuid, "reason" varchar(300), "actor_account_id" uuid NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "folio_entries_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "folio_entries_payment_method_check" CHECK ("payment_method" IS NULL OR "payment_method" IN ('Efectivo','Tarjeta','Transferencia','Yape','Plin')),
  CONSTRAINT "folio_entries_property_source_unique" UNIQUE("property_id","source_type","source_id"), CONSTRAINT "folio_entries_property_idempotency_unique" UNIQUE("property_id","idempotency_key")
);--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_folio_property_fkey" FOREIGN KEY ("folio_id","property_id") REFERENCES "folios"("id","property_id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_stay_property_fkey" FOREIGN KEY ("stay_id","property_id") REFERENCES "stays"("id","property_id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "folio_entries" ADD CONSTRAINT "folio_entries_reversal_fkey" FOREIGN KEY ("reversal_of_entry_id") REFERENCES "folio_entries"("id") ON DELETE restrict;--> statement-breakpoint
CREATE UNIQUE INDEX "folio_entries_one_reversal_idx" ON "folio_entries" ("reversal_of_entry_id") WHERE "reversal_of_entry_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "folio_entries_stay_created_idx" ON "folio_entries" ("stay_id","created_at");--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_property_reference_unique" UNIQUE("property_id","reference_id");--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES ('stays.check_out_override', 'Override positive folio balance at checkout') ON CONFLICT ("key") DO NOTHING;
