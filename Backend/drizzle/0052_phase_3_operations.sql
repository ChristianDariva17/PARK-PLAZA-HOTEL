CREATE TABLE IF NOT EXISTS "schema_sentinels" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "version" varchar(64) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "schema_sentinels" ("key", "version")
VALUES ('application_schema', '0052_phase_3_operations')
ON CONFLICT ("key") DO UPDATE SET
  "version" = EXCLUDED."version",
  "updated_at" = now();
