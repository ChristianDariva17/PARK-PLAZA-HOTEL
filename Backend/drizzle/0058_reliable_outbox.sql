DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM outbox_events
    WHERE status NOT IN ('pending', 'processing', 'sent', 'dead_letter')
  ) THEN
    RAISE EXCEPTION 'Outbox contains an unknown status';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE outbox_events
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS lock_token varchar(64),
  ADD COLUMN IF NOT EXISTS failed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS error_code varchar(64);
--> statement-breakpoint
UPDATE outbox_events
SET max_attempts = GREATEST(attempts, 8)
WHERE attempts > max_attempts;
--> statement-breakpoint
UPDATE outbox_events
SET status = 'dead_letter',
    failed_at = COALESCE(failed_at, now()),
    locked_at = NULL,
    lock_token = NULL,
    error_code = 'MAX_ATTEMPTS_EXCEEDED',
    last_error = 'MAX_ATTEMPTS_EXCEEDED'
WHERE status IN ('pending', 'processing')
  AND attempts >= max_attempts;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_status_check') THEN
    ALTER TABLE outbox_events
      ADD CONSTRAINT outbox_events_status_check
      CHECK (status IN ('pending', 'processing', 'sent', 'dead_letter'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_attempts_check') THEN
    ALTER TABLE outbox_events
      ADD CONSTRAINT outbox_events_attempts_check
      CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts);
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS outbox_events_dead_letter_idx
  ON outbox_events (failed_at, created_at)
  WHERE status = 'dead_letter';
--> statement-breakpoint
INSERT INTO permissions (key, description)
VALUES ('audit.manage', 'Inspect and requeue failed outbox events')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles CROSS JOIN permissions
WHERE roles.key = 'administrator' AND permissions.key = 'audit.manage'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO schema_sentinels (key, version)
VALUES ('application_schema', '0058_reliable_outbox')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
