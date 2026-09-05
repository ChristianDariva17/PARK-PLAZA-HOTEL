ALTER TABLE "orders" ADD COLUMN "delivery_mode" varchar(16);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_mode" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_classification" varchar(20) NOT NULL DEFAULT 'legacy_unknown';--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD COLUMN "operation" varchar(24) NOT NULL DEFAULT 'create';--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD COLUMN "response_status" varchar(3) NOT NULL DEFAULT '201';--> statement-breakpoint
ALTER TABLE "customer_order_commands" ALTER COLUMN "response" TYPE jsonb USING jsonb_build_object('status', response_status::integer, 'body', response);--> statement-breakpoint
ALTER TABLE "customer_order_commands" DROP CONSTRAINT "customer_order_commands_customer_key_unique";--> statement-breakpoint
ALTER TABLE "customer_order_commands" ADD CONSTRAINT "customer_order_commands_customer_operation_key_unique" UNIQUE("customer_account_id", "operation", "idempotency_key");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_checkout_facts_check" CHECK ((checkout_classification = 'legacy_unknown' AND delivery_mode IS NULL AND payment_mode IS NULL) OR (checkout_classification = 'customer_checkout' AND delivery_mode IN ('Room', 'Terraza', 'Recojo') AND payment_mode = 'room_charge'));
