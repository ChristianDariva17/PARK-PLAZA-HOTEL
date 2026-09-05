INSERT INTO "permissions" ("id", "key", "description", "created_at")
VALUES (gen_random_uuid(), 'settings.manage', 'Allows the user to manage and edit property configuration settings', NOW())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r.id, p.id, NOW()
FROM "roles" r, "permissions" p
WHERE r.key = 'administrator' AND p.key = 'settings.manage'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
