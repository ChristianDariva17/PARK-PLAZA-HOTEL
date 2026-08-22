ALTER TABLE guests
  ADD COLUMN property_id uuid,
  ADD COLUMN address varchar(500),
  ADD COLUMN emergency_contact varchar(255),
  ADD COLUMN notes varchar(2000);

DO $$
DECLARE
  unmapped_count integer;
  ambiguous_count integer;
  missing_document_count integer;
BEGIN
  WITH guest_property_candidates AS (
    SELECT primary_guest_id AS guest_id, property_id FROM reservations
    UNION
    SELECT rg.guest_id, r.property_id
    FROM reservation_guests rg
    JOIN reservations r ON r.id = rg.reservation_id
  ), candidate_counts AS (
    SELECT g.id, count(DISTINCT c.property_id) AS property_count
    FROM guests g
    LEFT JOIN guest_property_candidates c ON c.guest_id = g.id
    GROUP BY g.id
  )
  SELECT
    count(*) FILTER (WHERE property_count = 0),
    count(*) FILTER (WHERE property_count > 1)
  INTO unmapped_count, ambiguous_count
  FROM candidate_counts;

  SELECT count(*)
  INTO missing_document_count
  FROM (
    SELECT g.id
    FROM guests g
    LEFT JOIN identity_documents d ON d.guest_id = g.id
    GROUP BY g.id
    HAVING count(d.id) = 0
  ) invalid_guests;

  IF unmapped_count > 0 OR ambiguous_count > 0 OR missing_document_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'Cannot migrate legacy guests safely: %s have no property evidence, %s belong to multiple properties, and %s have no identity document. Associate every guest with reservations from exactly one property and add at least one document per guest before retrying.',
        unmapped_count,
        ambiguous_count,
        missing_document_count
      );
  END IF;
END $$;

WITH guest_property_candidates AS (
  SELECT primary_guest_id AS guest_id, property_id FROM reservations
  UNION
  SELECT rg.guest_id, r.property_id
  FROM reservation_guests rg
  JOIN reservations r ON r.id = rg.reservation_id
), guest_properties AS (
  SELECT guest_id, min(property_id::text)::uuid AS property_id
  FROM guest_property_candidates
  GROUP BY guest_id
)
UPDATE guests g
SET property_id = gp.property_id
FROM guest_properties gp
WHERE gp.guest_id = g.id;

ALTER TABLE guests ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE guests
  ADD CONSTRAINT guests_property_id_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT,
  ADD CONSTRAINT guests_id_property_id_unique UNIQUE (id, property_id);

ALTER TABLE reservations
  ADD CONSTRAINT reservations_id_property_id_unique UNIQUE (id, property_id),
  ADD CONSTRAINT reservations_primary_guest_property_fkey
    FOREIGN KEY (primary_guest_id, property_id) REFERENCES guests(id, property_id) ON DELETE RESTRICT;
ALTER TABLE reservations DROP CONSTRAINT reservations_primary_guest_id_fkey;

ALTER TABLE reservation_guests ADD COLUMN property_id uuid;
UPDATE reservation_guests rg
SET property_id = r.property_id
FROM reservations r
WHERE r.id = rg.reservation_id;
ALTER TABLE reservation_guests ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE reservation_guests
  ADD CONSTRAINT reservation_guests_reservation_property_fkey
    FOREIGN KEY (reservation_id, property_id) REFERENCES reservations(id, property_id) ON DELETE CASCADE,
  ADD CONSTRAINT reservation_guests_guest_property_fkey
    FOREIGN KEY (guest_id, property_id) REFERENCES guests(id, property_id) ON DELETE RESTRICT;
ALTER TABLE reservation_guests
  DROP CONSTRAINT reservation_guests_reservation_id_fkey,
  DROP CONSTRAINT reservation_guests_guest_id_fkey;

DROP INDEX guests_name_idx;
CREATE INDEX guests_property_name_idx ON guests(property_id, last_name, first_name, id);

ALTER TABLE identity_documents
  ADD COLUMN property_id uuid,
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

UPDATE identity_documents d
SET property_id = g.property_id
FROM guests g
WHERE g.id = d.guest_id;

WITH ranked_documents AS (
  SELECT id, row_number() OVER (PARTITION BY guest_id ORDER BY created_at, id) AS position
  FROM identity_documents
)
UPDATE identity_documents d
SET is_primary = (ranked.position = 1)
FROM ranked_documents ranked
WHERE ranked.id = d.id;

ALTER TABLE identity_documents ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE identity_documents
  ADD CONSTRAINT identity_documents_property_document_unique
    UNIQUE (property_id, type, issuing_country, document_number),
  ADD CONSTRAINT identity_documents_guest_property_fkey
    FOREIGN KEY (guest_id, property_id) REFERENCES guests(id, property_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE identity_documents VALIDATE CONSTRAINT identity_documents_guest_property_fkey;
ALTER TABLE identity_documents
  DROP CONSTRAINT identity_documents_guest_id_fkey,
  DROP CONSTRAINT identity_documents_type_issuing_country_document_number_key;

CREATE UNIQUE INDEX identity_documents_one_primary_idx ON identity_documents(guest_id) WHERE is_primary;
