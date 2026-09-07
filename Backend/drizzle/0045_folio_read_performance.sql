CREATE INDEX IF NOT EXISTS "folio_entries_property_stay_created_idx" ON "folio_entries" USING btree ("property_id", "stay_id", "created_at");
