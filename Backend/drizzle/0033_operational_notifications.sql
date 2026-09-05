CREATE TABLE IF NOT EXISTS communication_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel varchar(50) NOT NULL,
  purpose varchar(50) NOT NULL,
  opt_in boolean NOT NULL DEFAULT false,
  consent_version varchar(20),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  target_role varchar(50),
  target_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  type varchar(50) NOT NULL,
  title varchar(150) NOT NULL,
  content varchar(500) NOT NULL,
  action_link varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key IN ('administrator', 'receptionist', 'cleaning', 'kitchen')
  AND p.key IN ('notifications.read', 'notifications.update')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO notifications (property_id, target_account_id, type, title, content, action_link, metadata, created_at)
SELECT
  a.property_id,
  a.actor_account_id,
  'INFO',
  a.event_type,
  'Se registró la operación ' || a.event_type || CASE WHEN a.subject_type IS NULL THEN '.' ELSE ' sobre ' || a.subject_type || '.' END,
  '/dashboard',
  jsonb_build_object('auditEventId', a.id),
  a.occurred_at
FROM audit_events a
WHERE a.property_id IS NOT NULL
  AND a.actor_account_id IS NOT NULL
  AND a.event_type NOT LIKE 'notification.%'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.target_account_id = a.actor_account_id
      AND n.metadata ->> 'auditEventId' = a.id::text
  );
--> statement-breakpoint
INSERT INTO notifications (property_id, target_role, type, title, content, action_link, metadata, created_at)
SELECT
  a.property_id,
  'administrator',
  'INFO',
  a.event_type,
  'Se registró la operación ' || a.event_type || CASE WHEN a.subject_type IS NULL THEN '.' ELSE ' sobre ' || a.subject_type || '.' END,
  '/dashboard',
  jsonb_build_object('auditEventId', a.id),
  a.occurred_at
FROM audit_events a
WHERE a.property_id IS NOT NULL
  AND a.event_type NOT LIKE 'notification.%'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.target_role = 'administrator'
      AND n.metadata ->> 'auditEventId' = a.id::text
  );
