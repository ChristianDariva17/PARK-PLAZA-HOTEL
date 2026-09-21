-- 0055 was already applied before the application sentinel update was added.
-- Repair the sentinel in a new forward-only migration; never rewrite 0055.
INSERT INTO schema_sentinels (key, version)
VALUES ('application_schema', '0056_reconcile_schema_sentinel')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
