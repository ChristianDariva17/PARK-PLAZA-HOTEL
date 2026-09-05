ALTER TABLE "pets" ALTER COLUMN "client_id" DROP NOT NULL;

ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "breed" varchar(100);
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "vaccination_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "temperament" varchar(50);
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "emergency_contact" varchar(100);
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "welcome_kit_delivered" boolean DEFAULT false NOT NULL;
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "origin_type" varchar(50) DEFAULT 'stay' NOT NULL;
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "owner_name" varchar(100);
ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "owner_phone" varchar(50);
