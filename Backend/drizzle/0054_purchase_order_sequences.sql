CREATE TABLE IF NOT EXISTS "purchase_order_sequences" (
  "property_id" uuid NOT NULL,
  "year_month" varchar(6) NOT NULL,
  "next_value" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "purchase_order_sequences_pkey" PRIMARY KEY("property_id", "year_month"),
  CONSTRAINT "purchase_order_sequences_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade,
  CONSTRAINT "purchase_order_sequences_next_value_check" CHECK ("next_value" >= 1)
);
--> statement-breakpoint
INSERT INTO "purchase_order_sequences" ("property_id", "year_month", "next_value")
SELECT
  "property_id",
  substring("order_number" FROM '^OC-([0-9]{6})-') AS "year_month",
  max((substring("order_number" FROM '-([0-9]+)$'))::integer) + 1 AS "next_value"
FROM "purchase_orders"
WHERE "order_number" ~ '^OC-[0-9]{6}-[0-9]+$'
GROUP BY "property_id", substring("order_number" FROM '^OC-([0-9]{6})-')
ON CONFLICT ("property_id", "year_month") DO UPDATE SET
  "next_value" = GREATEST("purchase_order_sequences"."next_value", EXCLUDED."next_value"),
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "schema_sentinels" ("key", "version")
VALUES ('application_schema', '0054_purchase_order_sequences')
ON CONFLICT ("key") DO UPDATE SET
  "version" = EXCLUDED."version",
  "updated_at" = now();
