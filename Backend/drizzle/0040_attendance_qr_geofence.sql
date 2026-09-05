ALTER TYPE "public"."attendance_method" ADD VALUE IF NOT EXISTS 'QR_GPS';
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "geofence_radius_meters" integer DEFAULT 80 NOT NULL;
