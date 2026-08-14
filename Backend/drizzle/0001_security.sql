CREATE TYPE account_status AS ENUM ('active', 'disabled');
CREATE TYPE login_attempt_kind AS ENUM ('ip', 'account');

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(64) NOT NULL UNIQUE,
  name varchar(100) NOT NULL, is_system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(100) NOT NULL UNIQUE,
  description varchar(255) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_key_check CHECK (key ~ '^[a-z][a-z0-9_]*[.][a-z][a-z0-9_]*$')
);
CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT, email varchar(254) NOT NULL,
  password_hash text NOT NULL, status account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_email_normalized_check CHECK (email = lower(btrim(email))), UNIQUE (id, property_id)
);
CREATE UNIQUE INDEX accounts_email_unique ON accounts(email);
CREATE INDEX accounts_property_idx ON accounts(property_id);
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  account_id uuid UNIQUE, first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (account_id, property_id) REFERENCES accounts(id, property_id) ON DELETE RESTRICT
);
CREATE INDEX staff_property_idx ON staff(property_id);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, revocation_reason varchar(32), ip_address varchar(64), user_agent varchar(512)
);
CREATE UNIQUE INDEX sessions_one_active_per_account ON sessions(account_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_token_lookup_idx ON sessions(token_hash);
CREATE TABLE recovery_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, consumed_at timestamptz
);
CREATE INDEX recovery_tokens_account_idx ON recovery_tokens(account_id);
CREATE TABLE login_attempts (
  kind login_attempt_kind NOT NULL, key_hash varchar(64) NOT NULL, failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, key_hash),
  CONSTRAINT login_attempts_failure_count_check CHECK (failure_count >= 0)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type varchar(100) NOT NULL, request_id varchar(128), actor_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  subject_type varchar(64), subject_id varchar(128), property_id uuid REFERENCES properties(id) ON DELETE RESTRICT,
  ip_address varchar(64), user_agent varchar(512), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_actor_time_idx ON audit_events(actor_account_id, occurred_at);
CREATE INDEX audit_events_event_time_idx ON audit_events(event_type, occurred_at);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();

INSERT INTO permissions (key, description) VALUES
  ('accounts.read', 'View user accounts'), ('accounts.manage', 'Create and manage user accounts'),
  ('roles.read', 'View roles and permissions'), ('roles.manage', 'Manage role permission assignments'),
  ('audit.read', 'View audit history'), ('reservations.read', 'View reservations'),
  ('reservations.manage', 'Create and update reservations'), ('rooms.read', 'View rooms'),
  ('rooms.manage', 'Manage rooms'), ('guests.read', 'View guests'), ('guests.manage', 'Manage guests'),
  ('cleaning.read', 'View cleaning work'), ('cleaning.manage', 'Manage cleaning work'),
  ('kitchen.read', 'View kitchen orders'), ('kitchen.manage', 'Manage kitchen orders')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO roles (key, name, is_system) VALUES
  ('administrator', 'Administrador', true), ('receptionist', 'Recepcionista', true),
  ('cleaning', 'Limpieza', true), ('kitchen', 'Cocina', true)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, is_system = true;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'administrator'
   OR (r.key = 'receptionist' AND p.key IN ('reservations.read','reservations.manage','rooms.read','guests.read','guests.manage'))
   OR (r.key = 'cleaning' AND p.key IN ('rooms.read','cleaning.read','cleaning.manage'))
   OR (r.key = 'kitchen' AND p.key IN ('kitchen.read','kitchen.manage'))
ON CONFLICT DO NOTHING;
