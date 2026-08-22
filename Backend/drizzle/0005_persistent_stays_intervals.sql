CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE properties
  ADD COLUMN day_use_start varchar(5) NOT NULL DEFAULT '09:00',
  ADD COLUMN day_use_end varchar(5) NOT NULL DEFAULT '18:00',
  ADD COLUMN day_use_minimum_minutes integer NOT NULL DEFAULT 180,
  ADD COLUMN reservation_interval_minutes integer NOT NULL DEFAULT 30;
ALTER TABLE properties
  ADD CONSTRAINT properties_day_use_window_check CHECK (day_use_start ~ '^[0-2][0-9]:[0-5][0-9]$' AND day_use_end ~ '^[0-2][0-9]:[0-5][0-9]$' AND day_use_end > day_use_start),
  ADD CONSTRAINT properties_day_use_minimum_check CHECK (day_use_minimum_minutes > 0),
  ADD CONSTRAINT properties_reservation_interval_check CHECK (reservation_interval_minutes > 0 AND 1440 % reservation_interval_minutes = 0);

ALTER TABLE reservations ADD COLUMN check_in_at timestamptz, ADD COLUMN check_out_at timestamptz;

DO $$
DECLARE invalid_timezone_count integer; invalid_mapping_count integer; conflicting_mapping_count integer;
BEGIN
  SELECT count(*) INTO invalid_timezone_count FROM properties p WHERE NOT EXISTS (SELECT 1 FROM pg_timezone_names t WHERE t.name = p.timezone);
  IF invalid_timezone_count > 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Cannot migrate reservation intervals: %s properties have an unknown timezone.', invalid_timezone_count); END IF;

  WITH candidates AS (
    SELECT r.id, 'in' AS boundary, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes)) AS instant
    FROM reservations r JOIN properties p ON p.id = r.property_id CROSS JOIN generate_series(-840, 840, 15) offset_minutes
    WHERE timezone(p.timezone, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes))) = r.check_in::timestamp + time '15:00'
    UNION ALL
    SELECT r.id, 'out' AS boundary, ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes)) AS instant
    FROM reservations r JOIN properties p ON p.id = r.property_id CROSS JOIN generate_series(-840, 840, 15) offset_minutes
    WHERE timezone(p.timezone, ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes))) = r.check_out::timestamp + time '11:00'
  ), counts AS (SELECT id, boundary, count(*) AS candidate_count FROM candidates GROUP BY id, boundary)
  SELECT count(*) INTO invalid_mapping_count FROM reservations r
    LEFT JOIN counts check_in_count ON check_in_count.id = r.id AND check_in_count.boundary = 'in'
    LEFT JOIN counts check_out_count ON check_out_count.id = r.id AND check_out_count.boundary = 'out'
    WHERE coalesce(check_in_count.candidate_count, 0) <> 1 OR coalesce(check_out_count.candidate_count, 0) <> 1;
  IF invalid_mapping_count > 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Cannot migrate reservation intervals: %s legacy boundaries are ambiguous or nonexistent in their property timezone.', invalid_mapping_count); END IF;

  WITH mapped AS (
    SELECT r.id, min(c.instant) FILTER (WHERE c.boundary = 'in') AS check_in_at, min(c.instant) FILTER (WHERE c.boundary = 'out') AS check_out_at
    FROM reservations r JOIN properties p ON p.id = r.property_id JOIN LATERAL (
      SELECT 'in' AS boundary, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes)) AS instant FROM generate_series(-840, 840, 15) offset_minutes WHERE timezone(p.timezone, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes))) = r.check_in::timestamp + time '15:00'
      UNION ALL
      SELECT 'out', ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes)) FROM generate_series(-840, 840, 15) offset_minutes WHERE timezone(p.timezone, ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes))) = r.check_out::timestamp + time '11:00'
    ) c ON true GROUP BY r.id
  ), mapped_overlaps AS (
    SELECT 1 FROM mapped a JOIN reservations ra ON ra.id = a.id JOIN mapped b ON b.id <> a.id JOIN reservations rb ON rb.id = b.id
    WHERE ra.property_id = rb.property_id AND ra.room_id = rb.room_id AND ra.status IN ('pending','confirmed','checked_in') AND rb.status IN ('pending','confirmed','checked_in')
      AND a.check_in_at < b.check_out_at AND a.check_out_at > b.check_in_at LIMIT 1
  ) SELECT count(*) INTO conflicting_mapping_count FROM mapped_overlaps;
  IF conflicting_mapping_count > 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Cannot migrate reservation intervals: legacy mapping creates an active overlapping interval.'; END IF;
END $$;

WITH mapped AS (
  SELECT r.id, min(c.instant) FILTER (WHERE c.boundary = 'in') AS check_in_at, min(c.instant) FILTER (WHERE c.boundary = 'out') AS check_out_at
  FROM reservations r JOIN properties p ON p.id = r.property_id JOIN LATERAL (
    SELECT 'in' AS boundary, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes)) AS instant FROM generate_series(-840, 840, 15) offset_minutes WHERE timezone(p.timezone, ((r.check_in::timestamp + time '15:00') - make_interval(mins => offset_minutes))) = r.check_in::timestamp + time '15:00'
    UNION ALL
    SELECT 'out', ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes)) FROM generate_series(-840, 840, 15) offset_minutes WHERE timezone(p.timezone, ((r.check_out::timestamp + time '11:00') - make_interval(mins => offset_minutes))) = r.check_out::timestamp + time '11:00'
  ) c ON true GROUP BY r.id
) UPDATE reservations r SET check_in_at = m.check_in_at, check_out_at = m.check_out_at FROM mapped m WHERE m.id = r.id;

ALTER TABLE reservations ALTER COLUMN check_in_at SET NOT NULL, ALTER COLUMN check_out_at SET NOT NULL;
ALTER TABLE reservations ADD CONSTRAINT reservations_interval_check CHECK (check_out_at > check_in_at);
DROP INDEX IF EXISTS reservations_room_dates_idx;
CREATE INDEX reservations_room_interval_idx ON reservations(room_id, check_in_at, check_out_at);
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_active_overlap;
ALTER TABLE reservations ADD CONSTRAINT reservations_no_active_overlap EXCLUDE USING gist (property_id WITH =, room_id WITH =, tstzrange(check_in_at, check_out_at, '[)') WITH &&) WHERE (status IN ('pending','confirmed','checked_in'));

CREATE TYPE stay_status AS ENUM ('active', 'checked_out');
CREATE TABLE stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT, reservation_id uuid NOT NULL, room_id uuid NOT NULL,
  status stay_status NOT NULL DEFAULT 'active', check_in_at timestamptz NOT NULL, check_out_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stays_id_property_id_unique UNIQUE (id, property_id),
  CONSTRAINT stays_reservation_property_fkey FOREIGN KEY (reservation_id, property_id) REFERENCES reservations(id, property_id) ON DELETE RESTRICT,
  CONSTRAINT stays_room_property_fkey FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT,
  CONSTRAINT stays_checkout_state_check CHECK ((status = 'active' AND check_out_at IS NULL) OR (status = 'checked_out' AND check_out_at IS NOT NULL))
);
CREATE UNIQUE INDEX stays_one_active_per_reservation_idx ON stays(reservation_id) WHERE status = 'active';
CREATE UNIQUE INDEX stays_one_active_per_room_idx ON stays(room_id) WHERE status = 'active';
CREATE TABLE stay_guests (
  stay_id uuid NOT NULL, guest_id uuid NOT NULL, property_id uuid NOT NULL, is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stay_id, guest_id),
  CONSTRAINT stay_guests_stay_property_fkey FOREIGN KEY (stay_id, property_id) REFERENCES stays(id, property_id) ON DELETE CASCADE,
  CONSTRAINT stay_guests_guest_property_fkey FOREIGN KEY (guest_id, property_id) REFERENCES guests(id, property_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX stay_guests_one_primary_idx ON stay_guests(stay_id) WHERE is_primary;
CREATE TABLE folios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL, stay_id uuid NOT NULL UNIQUE, opening_balance numeric(14,2) NOT NULL DEFAULT 0.00, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folios_stay_property_fkey FOREIGN KEY (stay_id, property_id) REFERENCES stays(id, property_id) ON DELETE CASCADE,
  CONSTRAINT folios_zero_opening_balance_check CHECK (opening_balance = 0)
);
CREATE TABLE stay_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT, operation varchar(48) NOT NULL, idempotency_key uuid NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stay_commands_property_operation_key_unique UNIQUE (property_id, operation, idempotency_key)
);
CREATE INDEX stay_commands_property_created_idx ON stay_commands(property_id, created_at);

INSERT INTO permissions (key, description) VALUES ('stays.read', 'View stays and reception operations'), ('stays.check_in', 'Complete guest check-in'), ('stays.check_out', 'Complete guest check-out'), ('cleaning.progress', 'Progress and approve cleaning work') ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.key = 'receptionist' AND p.key IN ('stays.read','stays.check_in','stays.check_out') ON CONFLICT DO NOTHING;
