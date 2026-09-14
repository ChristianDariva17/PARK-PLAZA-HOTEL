-- Recover domain tables omitted from older migration journals before enforcing
-- the property-scoped constraints below. Existing installations are no-ops.
DO $$
BEGIN
  CREATE TYPE "public"."contract_status" AS ENUM('Borrador', 'Pendiente', 'Vigente', 'Reemplazado', 'Cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "reservation_id" uuid,
  "reference" varchar(128) NOT NULL,
  "status" "public"."contract_status" DEFAULT 'Borrador' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "contract_id" uuid NOT NULL,
  "version_number" varchar(32) NOT NULL,
  "creator_account_id" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reason" varchar(255) NOT NULL,
  "idempotency_key" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "origin_type" varchar(64) NOT NULL,
  "origin_id" uuid NOT NULL,
  "description" varchar(255) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "creator_account_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contract_evidence_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "contract_id" uuid NOT NULL,
  "evidence_id" uuid NOT NULL,
  "relation_type" varchar(64) NOT NULL,
  "linked_by_account_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experiences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "name" varchar(150) NOT NULL,
  "description" varchar(500),
  "type" varchar(50) NOT NULL,
  "max_capacity" integer,
  "requires_reservation" boolean DEFAULT false NOT NULL,
  "price" numeric(14, 2) DEFAULT '0' NOT NULL,
  "status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experience_participations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE RESTRICT,
  "experience_id" uuid NOT NULL,
  "stay_id" uuid,
  "guest_id" uuid,
  "pax" integer DEFAULT 1 NOT NULL,
  "scheduled_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'REQUESTED' NOT NULL,
  "cancel_reason" varchar(255),
  "idempotency_key" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "registered_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contract_evidence_links_unique"
  ON "contract_evidence_links" USING btree ("contract_id", "evidence_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contract_versions_contract_number_unique"
  ON "contract_versions" USING btree ("contract_id", "version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contract_versions_idempotency_unique"
  ON "contract_versions" USING btree ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_property_reference_unique"
  ON "contracts" USING btree ("property_id", "reference");
--> statement-breakpoint
INSERT INTO permissions (key, description) VALUES
  ('experiences.read', 'View hotel experiences and participations'),
  ('experiences.create', 'Create hotel experiences'),
  ('experiences.update', 'Update hotel experiences'),
  ('experiences.participate', 'Register experience participations'),
  ('evidence.manage', 'Register and link operational evidence')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'administrator'
   OR (r.key = 'receptionist' AND p.key IN ('experiences.read', 'experiences.create', 'experiences.update', 'experiences.participate', 'evidence.manage'))
   OR (r.key = 'cleaning' AND p.key IN ('evidence.manage'))
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contracts c JOIN reservations r ON r.id = c.reservation_id WHERE c.property_id <> r.property_id) THEN
    RAISE EXCEPTION 'Cross-property contract reservation data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_versions v JOIN contracts c ON c.id = v.contract_id WHERE v.property_id <> c.property_id) THEN
    RAISE EXCEPTION 'Cross-property contract version data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_versions v JOIN accounts a ON a.id = v.creator_account_id WHERE v.property_id <> a.property_id) THEN
    RAISE EXCEPTION 'Cross-property contract creator data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM evidences e JOIN accounts a ON a.id = e.creator_account_id WHERE e.property_id <> a.property_id) THEN
    RAISE EXCEPTION 'Cross-property evidence creator data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_evidence_links l JOIN contracts c ON c.id = l.contract_id WHERE l.property_id <> c.property_id) THEN
    RAISE EXCEPTION 'Cross-property contract evidence data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_evidence_links l JOIN evidences e ON e.id = l.evidence_id WHERE l.property_id <> e.property_id) THEN
    RAISE EXCEPTION 'Cross-property evidence link data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_evidence_links l JOIN accounts a ON a.id = l.linked_by_account_id WHERE l.property_id <> a.property_id) THEN
    RAISE EXCEPTION 'Cross-property evidence linker data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM experiences e JOIN accounts a ON a.id = e.published_by WHERE e.property_id <> a.property_id) THEN
    RAISE EXCEPTION 'Cross-property experience publisher data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM experience_participations p JOIN experiences e ON e.id = p.experience_id WHERE p.property_id <> e.property_id) THEN
    RAISE EXCEPTION 'Cross-property experience participation data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM experience_participations p JOIN stays s ON s.id = p.stay_id WHERE p.property_id <> s.property_id) THEN
    RAISE EXCEPTION 'Cross-property experience stay data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM experience_participations p JOIN guests g ON g.id = p.guest_id WHERE p.property_id <> g.property_id) THEN
    RAISE EXCEPTION 'Cross-property experience guest data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM experience_participations p JOIN accounts a ON a.id = p.registered_by WHERE p.property_id <> a.property_id) THEN
    RAISE EXCEPTION 'Cross-property experience registrar data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_profiles p JOIN staff s ON s.id = p.staff_id WHERE p.property_id <> s.property_id) THEN
    RAISE EXCEPTION 'Cross-property staff profile data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM shift_instances i JOIN staff s ON s.id = i.staff_id WHERE i.property_id <> s.property_id) THEN
    RAISE EXCEPTION 'Cross-property shift data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_biometric_bindings b JOIN staff s ON s.id = b.staff_id WHERE b.property_id <> s.property_id) THEN
    RAISE EXCEPTION 'Cross-property biometric staff data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_biometric_bindings b JOIN attendance_devices d ON d.id = b.device_id WHERE b.property_id <> d.property_id) THEN
    RAISE EXCEPTION 'Cross-property biometric device data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM attendance_events e JOIN staff s ON s.id = e.staff_id WHERE e.property_id <> s.property_id) THEN
    RAISE EXCEPTION 'Cross-property attendance staff data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM attendance_events e JOIN shift_instances i ON i.id = e.shift_instance_id WHERE e.property_id <> i.property_id) THEN
    RAISE EXCEPTION 'Cross-property attendance shift data detected';
  END IF;
  IF EXISTS (SELECT 1 FROM attendance_events e JOIN attendance_devices d ON d.id = e.device_id WHERE e.property_id <> d.property_id) THEN
    RAISE EXCEPTION 'Cross-property attendance device data detected';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE experiences ADD CONSTRAINT experiences_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE evidences ADD CONSTRAINT evidences_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE staff ADD CONSTRAINT staff_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE attendance_devices ADD CONSTRAINT attendance_devices_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE shift_instances ADD CONSTRAINT shift_instances_id_property_id_unique UNIQUE (id, property_id);
--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_reservation_property_fkey
  FOREIGN KEY (reservation_id, property_id) REFERENCES reservations (id, property_id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE contract_versions ADD CONSTRAINT contract_versions_contract_property_fkey
  FOREIGN KEY (contract_id, property_id) REFERENCES contracts (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE contract_versions ADD CONSTRAINT contract_versions_creator_property_fkey
  FOREIGN KEY (creator_account_id, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE evidences ADD CONSTRAINT evidences_creator_property_fkey
  FOREIGN KEY (creator_account_id, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE contract_evidence_links ADD CONSTRAINT contract_evidence_links_contract_property_fkey
  FOREIGN KEY (contract_id, property_id) REFERENCES contracts (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE contract_evidence_links ADD CONSTRAINT contract_evidence_links_evidence_property_fkey
  FOREIGN KEY (evidence_id, property_id) REFERENCES evidences (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE contract_evidence_links ADD CONSTRAINT contract_evidence_links_linked_by_property_fkey
  FOREIGN KEY (linked_by_account_id, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE experiences ADD CONSTRAINT experiences_published_by_property_fkey
  FOREIGN KEY (published_by, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE experience_participations ADD CONSTRAINT experience_participations_experience_property_fkey
  FOREIGN KEY (experience_id, property_id) REFERENCES experiences (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE experience_participations ADD CONSTRAINT experience_participations_stay_property_fkey
  FOREIGN KEY (stay_id, property_id) REFERENCES stays (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE experience_participations ADD CONSTRAINT experience_participations_guest_property_fkey
  FOREIGN KEY (guest_id, property_id) REFERENCES guests (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE experience_participations ADD CONSTRAINT experience_participations_registered_by_property_fkey
  FOREIGN KEY (registered_by, property_id) REFERENCES accounts (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE staff_profiles ADD CONSTRAINT staff_profiles_staff_property_fkey
  FOREIGN KEY (staff_id, property_id) REFERENCES staff (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE shift_instances ADD CONSTRAINT shift_instances_staff_property_fkey
  FOREIGN KEY (staff_id, property_id) REFERENCES staff (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE staff_biometric_bindings ADD CONSTRAINT staff_biometric_bindings_staff_property_fkey
  FOREIGN KEY (staff_id, property_id) REFERENCES staff (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE staff_biometric_bindings ADD CONSTRAINT staff_biometric_bindings_device_property_fkey
  FOREIGN KEY (device_id, property_id) REFERENCES attendance_devices (id, property_id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_staff_property_fkey
  FOREIGN KEY (staff_id, property_id) REFERENCES staff (id, property_id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_shift_property_fkey
  FOREIGN KEY (shift_instance_id, property_id) REFERENCES shift_instances (id, property_id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_device_property_fkey
  FOREIGN KEY (device_id, property_id) REFERENCES attendance_devices (id, property_id) ON DELETE SET NULL;
