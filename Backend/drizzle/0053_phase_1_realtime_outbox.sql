ALTER TABLE "outbox_events"
  ADD COLUMN IF NOT EXISTS "stay_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "outbox_events"
    ADD CONSTRAINT "outbox_events_stay_id_stays_id_fk"
    FOREIGN KEY ("stay_id") REFERENCES "stays"("id") ON DELETE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_stay_idx"
  ON "outbox_events" USING btree ("stay_id", "created_at");
--> statement-breakpoint
INSERT INTO "schema_sentinels" ("key", "version")
VALUES ('application_schema', '0053_phase_1_realtime_outbox')
ON CONFLICT ("key") DO UPDATE SET
  "version" = EXCLUDED."version",
  "updated_at" = now();
