ALTER TABLE "amenity_reservations" ALTER COLUMN "stay_id" DROP NOT NULL;
ALTER TABLE "amenity_reservations" ADD COLUMN "customer_account_id" uuid REFERENCES "customer_accounts"("id") ON DELETE RESTRICT;
ALTER TABLE "amenity_reservations" ADD CONSTRAINT "amenity_reservations_owner_check" CHECK ("stay_id" IS NOT NULL OR "customer_account_id" IS NOT NULL);
