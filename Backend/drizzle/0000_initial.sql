CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE room_status AS ENUM ('available', 'reserved', 'occupied', 'cleaning', 'maintenance', 'blocked', 'out_of_service');
CREATE TYPE guest_status AS ENUM ('active', 'archived');
CREATE TYPE identity_document_type AS ENUM ('dni', 'passport', 'foreign_id', 'other');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'expired');

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(32) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  timezone varchar(64) NOT NULL DEFAULT 'America/Lima',
  currency varchar(3) NOT NULL DEFAULT 'PEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT properties_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE room_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  code varchar(32) NOT NULL,
  name varchar(100) NOT NULL,
  capacity integer NOT NULL,
  base_nightly_rate numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code), UNIQUE (id, property_id),
  CONSTRAINT room_categories_capacity_check CHECK (capacity > 0),
  CONSTRAINT room_categories_rate_check CHECK (base_nightly_rate >= 0)
);

CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  number varchar(16) NOT NULL,
  floor integer NOT NULL,
  status room_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, number), UNIQUE (id, property_id),
  FOREIGN KEY (category_id, property_id) REFERENCES room_categories(id, property_id) ON DELETE RESTRICT
);
CREATE INDEX rooms_category_idx ON rooms(category_id);

CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  birth_date date,
  nationality varchar(2),
  email varchar(254),
  phone varchar(32),
  status guest_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guests_nationality_check CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$')
);
CREATE INDEX guests_name_idx ON guests(last_name, first_name);

CREATE TABLE identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type identity_document_type NOT NULL,
  issuing_country varchar(2) NOT NULL,
  document_number varchar(64) NOT NULL,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, issuing_country, document_number),
  CONSTRAINT identity_documents_country_check CHECK (issuing_country ~ '^[A-Z]{2}$')
);
CREATE INDEX identity_documents_guest_idx ON identity_documents(guest_id);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  room_id uuid NOT NULL,
  primary_guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  status reservation_status NOT NULL DEFAULT 'pending',
  check_in date NOT NULL,
  check_out date NOT NULL,
  guest_count integer NOT NULL,
  nightly_rate numeric(14,2) NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT,
  CONSTRAINT reservations_dates_check CHECK (check_out > check_in),
  CONSTRAINT reservations_guest_count_check CHECK (guest_count > 0),
  CONSTRAINT reservations_money_check CHECK (nightly_rate >= 0 AND total_amount >= 0),
  CONSTRAINT reservations_no_active_overlap EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed', 'checked_in'))
);
CREATE INDEX reservations_room_dates_idx ON reservations(room_id, check_in, check_out);
CREATE INDEX reservations_primary_guest_idx ON reservations(primary_guest_id);

CREATE TABLE reservation_guests (
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, guest_id)
);
CREATE INDEX reservation_guests_guest_idx ON reservation_guests(guest_id);
CREATE UNIQUE INDEX reservation_guests_one_primary_idx ON reservation_guests(reservation_id) WHERE is_primary;
