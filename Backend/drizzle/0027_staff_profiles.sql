CREATE TABLE IF NOT EXISTS "staff_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "document_normalized" varchar(32) NOT NULL,
  "position" varchar(100),
  "department" varchar(100),
  "phone" varchar(32),
  "email" varchar(254),
  "status" varchar(32) DEFAULT 'Activo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_document_unique"
  ON "staff_profiles" USING btree ("property_id", "document_normalized")
  WHERE "staff_profiles"."status" = 'Activo';

CREATE INDEX IF NOT EXISTS "staff_profiles_staff_idx"
  ON "staff_profiles" USING btree ("staff_id");
