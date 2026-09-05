ALTER TABLE "stay_commands" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cleaning_commands" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD COLUMN IF NOT EXISTS "stay_id" uuid;--> statement-breakpoint
ALTER TABLE "receivable_commands" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_spaces" ADD COLUMN IF NOT EXISTS "opening_time" varchar(5) DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "event_spaces" ADD COLUMN IF NOT EXISTS "closing_time" varchar(5) DEFAULT '22:00';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cleaning_tasks_stay_idx" ON "cleaning_tasks" USING btree ("stay_id");
