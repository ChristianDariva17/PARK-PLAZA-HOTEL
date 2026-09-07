ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "rating" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "rating_notes" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"order_number" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"expected_delivery_date" timestamp,
	"currency" varchar(3) DEFAULT 'PEN' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"invoice_number" varchar(80),
	"rating" integer,
	"rating_notes" text,
	"issued_by_account_id" uuid,
	"sent_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_property_id_properties_id_fk') THEN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_supplier_id_suppliers_id_fk') THEN
    ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_purchase_orders_property_isolation" ON "purchase_orders" USING btree ("id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_supplier" ON "purchase_orders" USING btree ("property_id","supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_status" ON "purchase_orders" USING btree ("property_id","status");
