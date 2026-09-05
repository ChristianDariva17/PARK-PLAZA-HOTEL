DO $$ BEGIN
  CREATE TYPE "public"."attendance_correction_status" AS ENUM('Solicitado', 'Aprobado', 'Rechazado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."attendance_method" AS ENUM('Biométrico', 'Manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."attendance_movement" AS ENUM('Ingreso', 'Salida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."attendance_status" AS ENUM('Completado', 'Anomalía', 'Revisión Pendiente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "name" varchar(100) NOT NULL,
  "iana_timezone" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'Activo' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "planned_start_at" timestamp with time zone NOT NULL,
  "planned_end_at" timestamp with time zone NOT NULL,
  "iana_timezone" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'Programado' NOT NULL,
  "cancellation_reason" varchar(255),
  "origin" varchar(64) DEFAULT 'Generado' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "code" varchar(64) NOT NULL,
  "name" varchar(100) NOT NULL,
  "zone" varchar(100),
  "status" varchar(32) DEFAULT 'Activo' NOT NULL,
  "iana_timezone" varchar(64) NOT NULL,
  "inventory_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_schedule_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "work_schedule_id" uuid NOT NULL REFERENCES "work_schedules"("id") ON DELETE restrict,
  "valid_from" timestamp with time zone NOT NULL,
  "valid_to" timestamp with time zone,
  "pattern" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "shift_instance_id" uuid REFERENCES "shift_instances"("id") ON DELETE set null,
  "movement" "attendance_movement" NOT NULL,
  "method" "attendance_method" NOT NULL,
  "status" "attendance_status" DEFAULT 'Completado' NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "device_id" uuid REFERENCES "attendance_devices"("id") ON DELETE set null,
  "bridge_operation_id" varchar(64),
  "idempotency_key" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attendance_event_id" uuid NOT NULL REFERENCES "attendance_events"("id") ON DELETE restrict,
  "correction_type" varchar(64) NOT NULL,
  "proposed_values" jsonb NOT NULL,
  "reason" text NOT NULL,
  "requester_account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE restrict,
  "approver_account_id" uuid REFERENCES "accounts"("id") ON DELETE restrict,
  "status" "attendance_correction_status" DEFAULT 'Solicitado' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_biometric_bindings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE restrict,
  "staff_id" uuid NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "device_id" uuid NOT NULL REFERENCES "attendance_devices"("id") ON DELETE restrict,
  "template_reference" varchar(255) NOT NULL,
  "status" varchar(32) DEFAULT 'Activo' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_devices_code_unique" ON "attendance_devices" USING btree ("property_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_events_idempotency_unique" ON "attendance_events" USING btree ("property_id", "idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_events_bridge_op_unique" ON "attendance_events" USING btree ("bridge_operation_id") WHERE "bridge_operation_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_events_staff_time_idx" ON "attendance_events" USING btree ("staff_id", "occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_instances_staff_time_idx" ON "shift_instances" USING btree ("staff_id", "planned_start_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_biometric_bindings_active_unique" ON "staff_biometric_bindings" USING btree ("property_id", "staff_id", "device_id") WHERE "status" = 'Activo';
