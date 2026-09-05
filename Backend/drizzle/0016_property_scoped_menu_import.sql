CREATE TABLE "menu_import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "actor_account_id" uuid NOT NULL,
  "source_system" varchar(80) NOT NULL,
  "source_digest" varchar(64) NOT NULL,
  "mode" varchar(16) NOT NULL,
  "status" varchar(20) DEFAULT 'running' NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" varchar(300),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  CONSTRAINT "menu_import_runs_id_property_unique" UNIQUE("id", "property_id"),
  CONSTRAINT "menu_import_runs_mode_check" CHECK ("mode" IN ('preview', 'apply')),
  CONSTRAINT "menu_import_runs_status_check" CHECK ("status" IN ('running', 'completed', 'failed'))
);--> statement-breakpoint
CREATE TABLE "menu_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "management_mode" varchar(16) DEFAULT 'manual' NOT NULL,
  "source_system" varchar(80),
  "source_key" varchar(240),
  "source_hash" varchar(64),
  "last_import_run_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "menu_categories_id_property_unique" UNIQUE("id", "property_id"),
  CONSTRAINT "menu_categories_property_source_key_unique" UNIQUE("property_id", "source_system", "source_key"),
  CONSTRAINT "menu_categories_management_check" CHECK ("management_mode" IN ('manual', 'imported')),
  CONSTRAINT "menu_categories_source_check" CHECK (("management_mode" = 'manual' AND "source_system" IS NULL AND "source_key" IS NULL) OR ("management_mode" = 'imported' AND "source_system" IS NOT NULL AND "source_key" IS NOT NULL))
);--> statement-breakpoint
CREATE TABLE "production_stations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "production_stations_id_property_unique" UNIQUE("id", "property_id"),
  CONSTRAINT "production_stations_property_name_unique" UNIQUE("property_id", "name")
);--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "sale_price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "preparation_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "production_station_id" uuid;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "currency" varchar(3) DEFAULT 'PEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "management_mode" varchar(16) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "source_system" varchar(80);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "source_key" varchar(240);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "source_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "last_import_run_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_id_property_unique" UNIQUE("id", "property_id");--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_id_property_unique" UNIQUE("id", "property_id");--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_property_source_key_unique" UNIQUE("property_id", "source_system", "source_key");--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_currency_check" CHECK ("currency" = 'PEN');--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_management_check" CHECK ("management_mode" IN ('manual', 'imported'));--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_source_check" CHECK (("management_mode" = 'manual' AND "source_system" IS NULL AND "source_key" IS NULL) OR ("management_mode" = 'imported' AND "source_system" IS NOT NULL AND "source_key" IS NOT NULL));--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "name" varchar(80),
  "price" numeric(14, 2),
  "currency" varchar(3) DEFAULT 'PEN' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "is_available" boolean DEFAULT true NOT NULL,
  "management_mode" varchar(16) DEFAULT 'manual' NOT NULL,
  "source_system" varchar(80),
  "source_key" varchar(280),
  "source_hash" varchar(64),
  "last_import_run_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "menu_item_variants_id_property_item_unique" UNIQUE("id", "property_id", "menu_item_id"),
  CONSTRAINT "menu_item_variants_property_source_key_unique" UNIQUE("property_id", "source_system", "source_key"),
  CONSTRAINT "menu_item_variants_price_check" CHECK ("price" IS NULL OR "price" > 0),
  CONSTRAINT "menu_item_variants_currency_check" CHECK ("currency" = 'PEN'),
  CONSTRAINT "menu_item_variants_management_check" CHECK ("management_mode" IN ('manual', 'imported')),
  CONSTRAINT "menu_item_variants_source_check" CHECK (("management_mode" = 'manual' AND "source_system" IS NULL AND "source_key" IS NULL) OR ("management_mode" = 'imported' AND "source_system" IS NOT NULL AND "source_key" IS NOT NULL))
);--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD COLUMN "property_id" uuid;--> statement-breakpoint
UPDATE "menu_item_ingredients" AS ingredient SET "property_id" = item."property_id" FROM "menu_items" AS item WHERE item."id" = ingredient."menu_item_id";--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "property_id" uuid;--> statement-breakpoint
UPDATE "order_items" AS line SET "property_id" = parent."property_id" FROM "orders" AS parent WHERE parent."id" = line."order_id";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "property_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "menu_item_variant_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "menu_item_variant_name" varchar(80);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "currency" varchar(3) DEFAULT 'PEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_id_property_unique" UNIQUE("id", "property_id");--> statement-breakpoint
ALTER TABLE "menu_import_runs" ADD CONSTRAINT "menu_import_runs_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_import_runs" ADD CONSTRAINT "menu_import_runs_actor_property_fkey" FOREIGN KEY ("actor_account_id", "property_id") REFERENCES "accounts"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_import_run_property_fkey" FOREIGN KEY ("last_import_run_id", "property_id") REFERENCES "menu_import_runs"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "production_stations" ADD CONSTRAINT "production_stations_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_property_fkey" FOREIGN KEY ("category_id", "property_id") REFERENCES "menu_categories"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_property_fkey" FOREIGN KEY ("production_station_id", "property_id") REFERENCES "production_stations"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_import_run_property_fkey" FOREIGN KEY ("last_import_run_id", "property_id") REFERENCES "menu_import_runs"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_item_property_fkey" FOREIGN KEY ("menu_item_id", "property_id") REFERENCES "menu_items"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_import_run_property_fkey" FOREIGN KEY ("last_import_run_id", "property_id") REFERENCES "menu_import_runs"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" DROP CONSTRAINT "menu_ingredients_item_fkey";--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_ingredients_item_property_fkey" FOREIGN KEY ("menu_item_id", "property_id") REFERENCES "menu_items"("id", "property_id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_ingredients_inventory_property_fkey" FOREIGN KEY ("inventory_item_id", "property_id") REFERENCES "inventory_items"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "inventory_ledger" DROP CONSTRAINT "inventory_ledger_item_fkey";--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_item_property_fkey" FOREIGN KEY ("inventory_item_id", "property_id") REFERENCES "inventory_items"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_stay_id_fkey";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stay_property_fkey" FOREIGN KEY ("stay_id", "property_id") REFERENCES "stays"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_order_fkey";--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_menu_item_fkey";--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_property_fkey" FOREIGN KEY ("order_id", "property_id") REFERENCES "orders"("id", "property_id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_property_fkey" FOREIGN KEY ("menu_item_id", "property_id") REFERENCES "menu_items"("id", "property_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_property_item_fkey" FOREIGN KEY ("menu_item_variant_id", "property_id", "menu_item_id") REFERENCES "menu_item_variants"("id", "property_id", "menu_item_id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_currency_check" CHECK ("currency" = 'PEN');--> statement-breakpoint
CREATE INDEX "menu_import_runs_property_started_idx" ON "menu_import_runs" ("property_id", "started_at");--> statement-breakpoint
CREATE INDEX "menu_categories_property_position_idx" ON "menu_categories" ("property_id", "position");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" ("category_id", "position");--> statement-breakpoint
CREATE INDEX "menu_item_variants_item_position_idx" ON "menu_item_variants" ("menu_item_id", "position");
