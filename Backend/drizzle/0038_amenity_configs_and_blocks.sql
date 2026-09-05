ALTER TABLE "amenity_reservations" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "amenity_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "amenity_key" varchar(50) NOT NULL,
  "name" varchar(100) NOT NULL,
  "price_external" numeric(14, 2) NOT NULL DEFAULT '50.00',
  "price_guest" numeric(14, 2) NOT NULL DEFAULT '0.00',
  "duration_minutes" integer NOT NULL DEFAULT 120,
  "max_pax" integer NOT NULL DEFAULT 6,
  "capacity" integer NOT NULL DEFAULT 24,
  "opening_hour" varchar(10) NOT NULL DEFAULT '08:00',
  "closing_hour" varchar(10) NOT NULL DEFAULT '20:00',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "amenity_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "amenity_key" varchar(50) NOT NULL,
  "reason" varchar(250) NOT NULL,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
