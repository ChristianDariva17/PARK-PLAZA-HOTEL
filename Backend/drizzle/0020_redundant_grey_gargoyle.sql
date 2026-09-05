ALTER TABLE "permissions" DROP CONSTRAINT "permissions_key_check";--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_key_check" CHECK (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$');--> statement-breakpoint
CREATE TYPE "public"."attendance_correction_status" AS ENUM('Solicitado', 'Aprobado', 'Rechazado');--> statement-breakpoint
CREATE TYPE "public"."attendance_method" AS ENUM('Biométrico', 'Manual');--> statement-breakpoint
CREATE TYPE "public"."attendance_movement" AS ENUM('Ingreso', 'Salida');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('Completado', 'Anomalía', 'Revisión Pendiente');--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_event_id" uuid NOT NULL,
	"correction_type" varchar(64) NOT NULL,
	"proposed_values" jsonb NOT NULL,
	"reason" text NOT NULL,
	"requester_account_id" uuid NOT NULL,
	"approver_account_id" uuid,
	"status" "attendance_correction_status" DEFAULT 'Solicitado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"zone" varchar(100),
	"status" varchar(32) DEFAULT 'Activo' NOT NULL,
	"iana_timezone" varchar(64) NOT NULL,
	"inventory_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_instance_id" uuid,
	"movement" "attendance_movement" NOT NULL,
	"method" "attendance_method" NOT NULL,
	"status" "attendance_status" DEFAULT 'Completado' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" uuid,
	"bridge_operation_id" varchar(64),
	"idempotency_key" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"planned_start_at" timestamp with time zone NOT NULL,
	"planned_end_at" timestamp with time zone NOT NULL,
	"iana_timezone" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'Programado' NOT NULL,
	"cancellation_reason" varchar(255),
	"origin" varchar(64) DEFAULT 'Generado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_biometric_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"template_reference" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'Activo' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"document_normalized" varchar(32) NOT NULL,
	"position" varchar(100),
	"department" varchar(100),
	"phone" varchar(32),
	"email" varchar(254),
	"status" varchar(32) DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedule_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"work_schedule_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"pattern" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"iana_timezone" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_attendance_event_id_attendance_events_id_fk" FOREIGN KEY ("attendance_event_id") REFERENCES "public"."attendance_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_requester_account_id_accounts_id_fk" FOREIGN KEY ("requester_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_approver_account_id_accounts_id_fk" FOREIGN KEY ("approver_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_shift_instance_id_shift_instances_id_fk" FOREIGN KEY ("shift_instance_id") REFERENCES "public"."shift_instances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_biometric_bindings" ADD CONSTRAINT "staff_biometric_bindings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_biometric_bindings" ADD CONSTRAINT "staff_biometric_bindings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_biometric_bindings" ADD CONSTRAINT "staff_biometric_bindings_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule_assignments" ADD CONSTRAINT "work_schedule_assignments_work_schedule_id_work_schedules_id_fk" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_devices_code_unique" ON "attendance_devices" USING btree ("property_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_events_idempotency_unique" ON "attendance_events" USING btree ("property_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_events_bridge_op_unique" ON "attendance_events" USING btree ("bridge_operation_id") WHERE "attendance_events"."bridge_operation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attendance_events_staff_time_idx" ON "attendance_events" USING btree ("staff_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shift_instances_staff_time_idx" ON "shift_instances" USING btree ("staff_id","planned_start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_biometric_bindings_active_unique" ON "staff_biometric_bindings" USING btree ("property_id","staff_id","device_id") WHERE "staff_biometric_bindings"."status" = 'Activo';--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_document_unique" ON "staff_profiles" USING btree ("property_id","document_normalized") WHERE "staff_profiles"."status" = 'Activo';--> statement-breakpoint
CREATE INDEX "staff_profiles_staff_idx" ON "staff_profiles" USING btree ("staff_id");
INSERT INTO permissions (key, description) VALUES
  ('staff.attendance.manual', 'Record manual staff attendance'),
  ('staff.attendance.correct', 'Submit staff attendance corrections'),
  ('staff.attendance.approve', 'Approve staff attendance corrections'),
  ('staff.attendance.read', 'View attendance and shifts without modification access')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key = 'administrator' AND p.key IN ('staff.attendance.manual', 'staff.attendance.correct', 'staff.attendance.approve', 'staff.attendance.read')
ON CONFLICT DO NOTHING;
