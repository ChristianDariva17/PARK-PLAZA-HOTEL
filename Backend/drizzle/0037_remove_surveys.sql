DROP TABLE IF EXISTS "survey_responses";
DROP TABLE IF EXISTS "surveys";

DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions"
  WHERE "key" IN ('surveys.read', 'surveys.respond')
);

DELETE FROM "permissions"
WHERE "key" IN ('surveys.read', 'surveys.respond');
