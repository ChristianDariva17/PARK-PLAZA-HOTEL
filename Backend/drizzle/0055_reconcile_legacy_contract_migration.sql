-- Migration 0024 was omitted from the historical journal. Its contract and
-- event schema is already recovered by 0030 and 0050. Keep existing history
-- immutable and fail loudly if a fresh or upgraded database is incomplete.
DO $$
BEGIN
  IF to_regclass('public.contracts') IS NULL
    OR to_regclass('public.contract_versions') IS NULL
    OR to_regclass('public.evidences') IS NULL
    OR to_regclass('public.contract_evidence_links') IS NULL THEN
    RAISE EXCEPTION 'Legacy contract migration reconciliation is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'quarantine_status'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'legacy_party_type'
  ) THEN
    RAISE EXCEPTION 'Legacy event migration reconciliation is incomplete';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO schema_sentinels (key, version)
VALUES ('legacy_contract_migration_reconciled', '0055_reconcile_legacy_contract_migration')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
--> statement-breakpoint
INSERT INTO schema_sentinels (key, version)
VALUES ('application_schema', '0055_reconcile_legacy_contract_migration')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
