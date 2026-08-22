CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"unit" varchar(40) NOT NULL,
	"lot" varchar(60),
	"stock" numeric(12, 4) DEFAULT '0' NOT NULL,
	"reserved" numeric(12, 4) DEFAULT '0' NOT NULL,
	"minimum" numeric(12, 4) DEFAULT '1' NOT NULL,
	"cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"supplier_id" varchar(48),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"type" varchar(30) NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"reference_id" varchar(48),
	"note" varchar(300),
	"responsible" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"quantity" numeric(10, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" varchar(60) NOT NULL,
	"sale_price" numeric(14, 2) NOT NULL,
	"description" varchar(400),
	"preparation_minutes" integer DEFAULT 10 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"menu_item_name" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"source" varchar(30) NOT NULL,
	"stay_id" uuid,
	"status" varchar(40) DEFAULT 'Pedido recibido' NOT NULL,
	"inventory_stage" varchar(20) DEFAULT 'Sin reservar' NOT NULL,
	"accounting_stage" varchar(20) DEFAULT 'Pendiente' NOT NULL,
	"payment_method" varchar(40) DEFAULT 'Efectivo' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"estimated_minutes" integer DEFAULT 15 NOT NULL,
	"comment" varchar(400),
	"responsible" varchar(120) NOT NULL,
	"cancel_reason" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_item_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_ingredients_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_items_property_status_idx" ON "inventory_items" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "inventory_ledger_item_created_idx" ON "inventory_ledger" USING btree ("inventory_item_id","created_at");--> statement-breakpoint
CREATE INDEX "menu_item_ingredients_item_idx" ON "menu_item_ingredients" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_items_property_status_idx" ON "menu_items" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_property_status_idx" ON "orders" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "orders_stay_idx" ON "orders" USING btree ("stay_id");