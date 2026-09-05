ALTER TABLE "amenity_reservations" ADD COLUMN IF NOT EXISTS "document_number" varchar(32);
ALTER TABLE "amenity_reservations" ADD COLUMN IF NOT EXISTS "customer_name" varchar(200);
ALTER TABLE "amenity_reservations" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) NOT NULL DEFAULT 'pending';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amenity_reservation_id" uuid REFERENCES "amenity_reservations"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "orders_amenity_idx" ON "orders"("amenity_reservation_id");
