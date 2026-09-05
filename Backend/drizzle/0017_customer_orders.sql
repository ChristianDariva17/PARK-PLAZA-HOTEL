CREATE TABLE "customer_orders" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"customer_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_order_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"customer_account_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_order_commands_customer_key_unique" UNIQUE("customer_account_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_order_property_fkey" FOREIGN KEY ("order_id","property_id") REFERENCES "public"."orders"("id","property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_property_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD CONSTRAINT "customer_order_commands_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD CONSTRAINT "customer_order_commands_property_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD CONSTRAINT "customer_order_commands_order_property_fkey" FOREIGN KEY ("order_id","property_id") REFERENCES "public"."orders"("id","property_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_order_commands_order_idx" ON "customer_order_commands" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_orders_owner_idx" ON "customer_orders" USING btree ("customer_account_id","created_at");
