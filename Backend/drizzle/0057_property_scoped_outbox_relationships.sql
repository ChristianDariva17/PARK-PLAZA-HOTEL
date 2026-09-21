-- Validate existing rows before replacing permissive foreign keys with
-- property-scoped relationships. A failure must stop the migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM outbox_events o
    WHERE o.stay_id IS NOT NULL
      AND (o.property_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM stays s
        WHERE s.id = o.stay_id AND s.property_id = o.property_id
      ))
  ) THEN
    RAISE EXCEPTION 'Outbox stay references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM amenity_reservations r
    WHERE r.stay_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM stays s
        WHERE s.id = r.stay_id AND s.property_id = r.property_id
      )
  ) THEN
    RAISE EXCEPTION 'Amenity reservation stay references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM customer_amenity_commands c
    WHERE NOT EXISTS (
      SELECT 1 FROM amenity_reservations r
      WHERE r.id = c.amenity_reservation_id AND r.property_id = c.property_id
    )
  ) THEN
    RAISE EXCEPTION 'Customer amenity command references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.amenity_reservation_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM amenity_reservations r
        WHERE r.id = o.amenity_reservation_id AND r.property_id = o.property_id
      )
  ) THEN
    RAISE EXCEPTION 'Order amenity references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_recurrence r
    WHERE NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = r.event_id AND e.property_id = r.property_id
    )
  ) THEN
    RAISE EXCEPTION 'Event recurrence references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_occurrence_exceptions x
    WHERE NOT EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = x.event_id AND e.property_id = x.property_id
    )
  ) THEN
    RAISE EXCEPTION 'Event exception references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_occurrence_exceptions x
    WHERE x.override_space_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM event_spaces s
        WHERE s.id = x.override_space_id AND s.property_id = x.property_id
      )
  ) THEN
    RAISE EXCEPTION 'Event exception space references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM supplier_bank_details b
    WHERE NOT EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = b.supplier_id AND s.property_id = b.property_id
    )
  ) THEN
    RAISE EXCEPTION 'Supplier bank references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM purchase_orders p
    WHERE NOT EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = p.supplier_id AND s.property_id = p.property_id
    )
  ) THEN
    RAISE EXCEPTION 'Purchase order supplier references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM suppliers s
    WHERE s.archived_by_account_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.id = s.archived_by_account_id AND a.property_id = s.property_id
      )
  ) THEN
    RAISE EXCEPTION 'Supplier archive actor references are not property-scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM purchase_orders p
    WHERE p.issued_by_account_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounts a
        WHERE a.id = p.issued_by_account_id AND a.property_id = p.property_id
      )
  ) THEN
    RAISE EXCEPTION 'Purchase order issuer references are not property-scoped';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS request_id varchar(128);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_stay_property_required') THEN
    ALTER TABLE outbox_events
      ADD CONSTRAINT outbox_events_stay_property_required
      CHECK (stay_id IS NULL OR property_id IS NOT NULL);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'amenity_reservations_id_property_unique'
  ) THEN
    ALTER TABLE amenity_reservations
      ADD CONSTRAINT amenity_reservations_id_property_unique UNIQUE (id, property_id);
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'outbox_events'::regclass
      AND c.confrelid = 'stays'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'outbox_events_stay_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE outbox_events DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'amenity_reservations'::regclass
      AND c.confrelid = 'stays'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'amenity_reservations_stay_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE amenity_reservations DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'customer_amenity_commands'::regclass
      AND c.confrelid = 'amenity_reservations'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'customer_amenity_commands_reservation_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE customer_amenity_commands DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'orders'::regclass
      AND c.confrelid = 'amenity_reservations'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'orders_amenity_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'event_recurrence'::regclass
      AND c.confrelid = 'events'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'event_recurrence_event_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE event_recurrence DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'event_occurrence_exceptions'::regclass
      AND c.confrelid = 'events'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'event_occurrence_exceptions_event_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE event_occurrence_exceptions DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'event_occurrence_exceptions'::regclass
      AND c.confrelid = 'event_spaces'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'event_occurrence_exceptions_override_space_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE event_occurrence_exceptions DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'supplier_bank_details'::regclass
      AND c.confrelid = 'suppliers'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'supplier_bank_details_supplier_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE supplier_bank_details DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'purchase_orders'::regclass
      AND c.confrelid = 'suppliers'::regclass
      AND c.contype = 'f'
      AND c.conname <> 'purchase_orders_supplier_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE purchase_orders DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'suppliers'::regclass
      AND c.confrelid IN ('accounts'::regclass, 'customer_accounts'::regclass)
      AND c.contype = 'f'
      AND c.conname <> 'suppliers_archived_by_property_fkey'
  LOOP
    EXECUTE format('ALTER TABLE suppliers DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outbox_events_stay_property_fkey') THEN
    ALTER TABLE outbox_events
      ADD CONSTRAINT outbox_events_stay_property_fkey
      FOREIGN KEY (stay_id, property_id) REFERENCES stays (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'amenity_reservations_stay_property_fkey') THEN
    ALTER TABLE amenity_reservations
      ADD CONSTRAINT amenity_reservations_stay_property_fkey
      FOREIGN KEY (stay_id, property_id) REFERENCES stays (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_amenity_commands_reservation_property_fkey') THEN
    ALTER TABLE customer_amenity_commands
      ADD CONSTRAINT customer_amenity_commands_reservation_property_fkey
      FOREIGN KEY (amenity_reservation_id, property_id) REFERENCES amenity_reservations (id, property_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amenity_property_fkey') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_amenity_property_fkey
      FOREIGN KEY (amenity_reservation_id, property_id) REFERENCES amenity_reservations (id, property_id) ON DELETE SET NULL (amenity_reservation_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_recurrence_event_property_fkey') THEN
    ALTER TABLE event_recurrence
      ADD CONSTRAINT event_recurrence_event_property_fkey
      FOREIGN KEY (event_id, property_id) REFERENCES events (id, property_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_occurrence_exceptions_event_property_fkey') THEN
    ALTER TABLE event_occurrence_exceptions
      ADD CONSTRAINT event_occurrence_exceptions_event_property_fkey
      FOREIGN KEY (event_id, property_id) REFERENCES events (id, property_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_occurrence_exceptions_override_space_property_fkey') THEN
    ALTER TABLE event_occurrence_exceptions
      ADD CONSTRAINT event_occurrence_exceptions_override_space_property_fkey
      FOREIGN KEY (override_space_id, property_id) REFERENCES event_spaces (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_bank_details_supplier_property_fkey') THEN
    ALTER TABLE supplier_bank_details
      ADD CONSTRAINT supplier_bank_details_supplier_property_fkey
      FOREIGN KEY (supplier_id, property_id) REFERENCES suppliers (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_supplier_property_fkey') THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_supplier_property_fkey
      FOREIGN KEY (supplier_id, property_id) REFERENCES suppliers (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_archived_by_property_fkey') THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_archived_by_property_fkey
      FOREIGN KEY (archived_by_account_id, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_issued_by_property_fkey') THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_issued_by_property_fkey
      FOREIGN KEY (issued_by_account_id, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO schema_sentinels (key, version)
VALUES ('application_schema', '0057_property_scoped_outbox_relationships')
ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, updated_at = now();
