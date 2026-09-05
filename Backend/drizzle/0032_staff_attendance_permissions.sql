ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_key_check;
--> statement-breakpoint
ALTER TABLE permissions ADD CONSTRAINT permissions_key_check CHECK (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');
--> statement-breakpoint
INSERT INTO permissions (key, description) VALUES
  ('staff.attendance.manual', 'Record manual staff attendance'),
  ('staff.attendance.correct', 'Submit staff attendance corrections'),
  ('staff.attendance.approve', 'Approve staff attendance corrections'),
  ('staff.attendance.read', 'View attendance and shifts without modification access')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'administrator'
  AND p.key IN ('staff.attendance.manual', 'staff.attendance.correct', 'staff.attendance.approve', 'staff.attendance.read')
ON CONFLICT DO NOTHING;
