ALTER TABLE event_space_services
  ADD COLUMN IF NOT EXISTS category varchar(64) NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS per_person boolean NOT NULL DEFAULT false;
--> statement-breakpoint
INSERT INTO schema_sentinels (key, version)
VALUES ('application_schema', '0059_event_space_service_metadata')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
