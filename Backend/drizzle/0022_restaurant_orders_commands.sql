CREATE TYPE "public"."restaurant_order_source" AS ENUM('Habitacion', 'Barra', 'Terraza', 'Portal Huésped', 'Recepcion', 'Restaurante');--> statement-breakpoint
CREATE TABLE "restaurant_order_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"order_id" uuid,
	"operation" varchar(30) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_order_cmds_idempotency_unique" UNIQUE("property_id","operation","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "supplier_bank_details" (
	"supplier_id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"bank_name" text,
	"account_type" varchar(50),
	"account_holder" text,
	"masked_account_number" varchar(10),
	"encrypted_payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"operation" varchar(50) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response_status" integer,
	"response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"legal_name_normalized" text NOT NULL,
	"tax_id" varchar(50) NOT NULL,
	"tax_id_normalized" varchar(50) NOT NULL,
	"trade_name" text,
	"contact_name" text,
	"phone" varchar(50),
	"email" text,
	"categories" text[],
	"average_delivery_days" integer DEFAULT 0,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"archived_by_account_id" uuid
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "source" SET DATA TYPE "public"."restaurant_order_source" USING "source"::"public"."restaurant_order_source";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurant_order_commands" ADD CONSTRAINT "restaurant_order_cmds_property_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_order_commands" ADD CONSTRAINT "restaurant_order_cmds_actor_fkey" FOREIGN KEY ("actor_account_id","property_id") REFERENCES "public"."accounts"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bank_details" ADD CONSTRAINT "supplier_bank_details_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_bank_details" ADD CONSTRAINT "supplier_bank_details_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_commands" ADD CONSTRAINT "supplier_commands_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_archived_by_account_id_customer_accounts_id_fk" FOREIGN KEY ("archived_by_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "restaurant_order_cmds_order_idx" ON "restaurant_order_commands" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_supplier_commands_unique" ON "supplier_commands" USING btree ("property_id","operation","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_suppliers_property_isolation" ON "suppliers" USING btree ("id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_suppliers_tax_id_active" ON "suppliers" USING btree ("property_id","tax_id_normalized") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_suppliers_list" ON "suppliers" USING btree ("property_id","status","legal_name_normalized");