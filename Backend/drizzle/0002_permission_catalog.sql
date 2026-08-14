INSERT INTO permissions (key, description) VALUES
  ('dashboard.read', 'View the operational dashboard'),
  ('accounts.read', 'View user accounts'), ('accounts.manage', 'Create and manage user accounts'),
  ('roles.read', 'View roles and permissions'), ('roles.manage', 'Manage role permission assignments'),
  ('audit.read', 'View audit history'),
  ('rooms.read', 'View rooms'), ('rooms.manage', 'Manage rooms'),
  ('rooms.update', 'Update room master data'), ('rooms.block', 'Block and unblock rooms'),
  ('reservations.read', 'View reservations'), ('reservations.manage', 'Create and update reservations'),
  ('reservations.create', 'Create reservations'), ('reservations.update', 'Update reservations'), ('reservations.cancel', 'Cancel and expire reservations'),
  ('contracts.read', 'View lodging contracts'), ('contracts.amend', 'Create contract addenda'), ('contracts.void', 'Void lodging contracts'),
  ('stays.read', 'View stays and reception operations'), ('stays.check_in', 'Complete guest check-in'), ('stays.check_out', 'Complete guest check-out'),
  ('finance.read', 'View guest accounts and payments'), ('finance.charge', 'Post account charges and penalties'),
  ('finance.payment', 'Post account payments'), ('finance.reverse', 'Reverse financial movements'),
  ('guests.read', 'View guests'), ('guests.manage', 'Manage guests'),
  ('guests.create', 'Create guest profiles'), ('guests.update', 'Update guest profiles'),
  ('guests.archive', 'Archive and reactivate guest profiles'), ('guests.biometric', 'Enroll and verify guest biometrics'),
  ('cleaning.read', 'View cleaning work'), ('cleaning.manage', 'Manage cleaning work'),
  ('cleaning.assign', 'Assign cleaning work'), ('cleaning.progress', 'Progress and approve cleaning work'),
  ('cleaning.report_incident', 'Report incidents from cleaning work'),
  ('maintenance.read', 'View maintenance work'), ('maintenance.create', 'Create maintenance tickets'),
  ('maintenance.update', 'Update maintenance tickets'), ('maintenance.progress', 'Progress and reopen maintenance tickets'),
  ('incidents.read', 'View incidents'), ('incidents.create', 'Create incidents'),
  ('incidents.update', 'Update incidents'), ('incidents.progress', 'Progress and reopen incidents'),
  ('evidence.read', 'View evidence references'),
  ('notifications.read', 'View internal notifications'), ('notifications.update', 'Mark internal notifications as read'),
  ('orders.read', 'View guest and point-of-sale orders'), ('orders.create', 'Create orders'),
  ('orders.update', 'Update orders'), ('orders.advance', 'Advance and settle orders'), ('orders.cancel', 'Cancel orders'),
  ('kitchen.read', 'View kitchen and bar recipes'), ('kitchen.manage', 'Manage kitchen and bar recipes'),
  ('kitchen.create', 'Create recipes'), ('kitchen.update', 'Update recipes'), ('kitchen.archive', 'Archive and reactivate recipes'),
  ('inventory.read', 'View inventory and ledger'), ('inventory.create', 'Create inventory lots'),
  ('inventory.update', 'Update inventory lots'), ('inventory.adjust', 'Post inventory adjustments'), ('inventory.archive', 'Archive inventory lots'),
  ('suppliers.read', 'View suppliers'), ('suppliers.create', 'Create suppliers'),
  ('suppliers.update', 'Update suppliers'), ('suppliers.archive', 'Archive suppliers'),
  ('parking.read', 'View parking records'), ('parking.create', 'Register parking entries'),
  ('parking.update', 'Update parking records'), ('parking.exit', 'Register parking exits'), ('parking.archive', 'Archive parking records'),
  ('pets.read', 'View guest pets'), ('pets.create', 'Register guest pets'),
  ('pets.update', 'Update guest pets'), ('pets.archive', 'Archive and reactivate guest pets'),
  ('recreation.read', 'View recreation services and access'), ('recreation.sell', 'Sell recreation access'),
  ('recreation.scan', 'Validate recreation access'), ('recreation.manual', 'Register manual recreation access'),
  ('events.read', 'View events'), ('events.create', 'Create events'), ('events.update', 'Update events'),
  ('events.confirm', 'Confirm events'), ('events.cancel', 'Cancel events'), ('events.archive', 'Archive events'),
  ('surveys.read', 'View surveys and loyalty summaries'), ('surveys.respond', 'Record survey responses'),
  ('staff.read', 'View staff, shifts, and attendance'), ('staff.create', 'Create staff profiles'),
  ('staff.update', 'Update staff profiles'), ('staff.archive', 'Archive and reactivate staff profiles'),
  ('staff.shifts', 'Manage staff shifts'), ('staff.attendance', 'Record staff attendance'), ('staff.biometric', 'Enroll and verify staff biometrics'),
  ('cash.read', 'View cash sessions and movements'), ('cash.open', 'Open cash sessions'),
  ('cash.move', 'Post cash movements'), ('cash.count', 'Record cash counts'), ('cash.close', 'Close cash sessions'),
  ('reports.read', 'View operational reports'), ('settings.read', 'View application settings')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id AND r.key IN ('receptionist', 'cleaning', 'kitchen');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'administrator'
   OR (r.key = 'receptionist' AND p.key IN (
     'rooms.read',
     'reservations.read','reservations.manage','reservations.create','reservations.update','reservations.cancel',
     'contracts.read','contracts.amend','stays.read','stays.check_in','stays.check_out',
     'finance.read','finance.charge','finance.payment',
     'guests.read','guests.manage','guests.create','guests.update','guests.archive','guests.biometric',
     'notifications.read','notifications.update',
     'parking.read','parking.create','parking.update','parking.exit','parking.archive',
     'pets.read','pets.create','pets.update','pets.archive',
     'recreation.read','recreation.sell','recreation.scan','recreation.manual',
     'surveys.read','surveys.respond','cash.read','cash.open','cash.move','cash.count','cash.close'
   ))
   OR (r.key = 'cleaning' AND p.key IN (
     'rooms.read','cleaning.read','cleaning.manage','cleaning.assign','cleaning.progress','cleaning.report_incident',
     'evidence.read','incidents.read','incidents.create'
   ))
   OR (r.key = 'kitchen' AND p.key IN (
     'orders.read','orders.create','orders.update','orders.advance','orders.cancel',
     'kitchen.read','kitchen.manage','kitchen.create','kitchen.update','kitchen.archive','inventory.read'
   ))
ON CONFLICT DO NOTHING;
