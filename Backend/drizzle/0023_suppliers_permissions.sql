INSERT INTO "permissions" ("key", "description") VALUES
('suppliers.reactivate', 'Permite reactivar un proveedor que fue archivado.')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";
