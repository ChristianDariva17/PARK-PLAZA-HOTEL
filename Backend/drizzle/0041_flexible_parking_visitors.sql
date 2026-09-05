ALTER TABLE "vehicle_registrations" ALTER COLUMN "stay_id" DROP NOT NULL;
ALTER TABLE "vehicle_registrations" ALTER COLUMN "client_id" DROP NOT NULL;
ALTER TABLE "vehicle_registrations" ALTER COLUMN "room_id" DROP NOT NULL;

ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "origin_type" varchar(30) DEFAULT 'stay' NOT NULL;
ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "driver_name" varchar(150);
ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "driver_phone" varchar(50);
ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "vehicle_color" varchar(50);
ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "keys_left" boolean DEFAULT false NOT NULL;
ALTER TABLE "vehicle_registrations" ADD COLUMN IF NOT EXISTS "entry_notes" text;
