ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customer_checkout_facts_check";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_checkout_facts_check" CHECK (
  (checkout_classification = 'legacy_unknown' AND delivery_mode IS NULL AND payment_mode IS NULL)
  OR (checkout_classification = 'customer_checkout' AND (
    (delivery_mode IN ('Room', 'Terraza', 'Recojo') AND payment_mode = 'room_charge')
    OR (delivery_mode IN ('Piscina', 'Mirador') AND payment_mode = 'amenity_tab')
  ))
);--> statement-breakpoint
