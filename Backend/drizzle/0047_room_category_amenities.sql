CREATE TABLE IF NOT EXISTS "room_category_amenities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "amenity_key" varchar(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "room_category_amenities_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade,
  CONSTRAINT "room_category_amenities_category_fkey" FOREIGN KEY ("category_id") REFERENCES "room_categories"("id") ON DELETE cascade,
  CONSTRAINT "room_category_amenities_unique" UNIQUE ("property_id", "category_id", "amenity_key")
);
CREATE INDEX IF NOT EXISTS "room_category_amenities_cat_idx" ON "room_category_amenities" ("category_id");
