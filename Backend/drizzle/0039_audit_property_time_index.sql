CREATE INDEX IF NOT EXISTS "audit_events_property_time_idx"
ON "audit_events" ("property_id", "occurred_at" DESC);
