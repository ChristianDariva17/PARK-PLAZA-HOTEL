INSERT INTO permissions (key, description) VALUES
  ('amenities.read', 'View amenity configuration and reservations'),
  ('amenities.config', 'Manage amenity configuration'),
  ('amenities.block', 'Block amenity availability'),
  ('amenities.create', 'Create manual amenity passes'),
  ('amenities.checkin', 'Check guests into amenities'),
  ('amenities.identity', 'Update amenity reservation identity'),
  ('amenities.settle', 'Settle amenity reservation accounts')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'administrator'
   OR (r.key = 'receptionist'
       AND p.key IN ('amenities.read', 'amenities.config', 'amenities.block', 'amenities.create', 'amenities.checkin', 'amenities.identity', 'amenities.settle'))
ON CONFLICT DO NOTHING;
