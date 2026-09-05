CREATE TYPE "public"."event_status" AS ENUM('draft', 'tentative', 'confirmed', 'cancelled', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_time_kind" AS ENUM('full_day', 'time_bound', 'multi_day');--> statement-breakpoint
CREATE TYPE "public"."event_exception_kind" AS ENUM('cancelled', 'modified');--> statement-breakpoint
CREATE TABLE "event_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"event_id" uuid,
	"operation" varchar(64) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"fingerprint" varchar(255) NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_occurrence_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_start_at" timestamp with time zone NOT NULL,
	"kind" "event_exception_kind" NOT NULL,
	"override_starts_at" timestamp with time zone,
	"override_ends_at" timestamp with time zone,
	"override_space_id" uuid,
	"override_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "event_recurrence" (
	"property_id" uuid NOT NULL,
	"event_id" uuid PRIMARY KEY NOT NULL,
	"rrule" varchar(500) NOT NULL,
	"series_timezone" varchar(64) NOT NULL,
	"until" timestamp with time zone,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "event_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"service_code" varchar(64) NOT NULL,
	"quantity" integer,
	"notes" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "event_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"capacity" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"guest_id" uuid,
	"customer_account_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" varchar(2000),
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"time_kind" "event_time_kind" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"attendees" integer DEFAULT 1 NOT NULL,
	"estimated_amount" numeric(12, 2),
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_account_id" uuid,
	"cancellation_reason" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "event_commands" ADD CONSTRAINT "event_commands_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_commands" ADD CONSTRAINT "event_commands_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exceptions" ADD CONSTRAINT "event_occurrence_exceptions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exceptions" ADD CONSTRAINT "event_occurrence_exceptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_occurrence_exceptions" ADD CONSTRAINT "event_occurrence_exceptions_override_space_id_event_spaces_id_fk" FOREIGN KEY ("override_space_id") REFERENCES "public"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_recurrence" ADD CONSTRAINT "event_recurrence_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_services" ADD CONSTRAINT "event_services_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_spaces" ADD CONSTRAINT "event_spaces_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_space_id_event_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_customer_account_id_customer_accounts_id_fk" FOREIGN KEY ("customer_account_id") REFERENCES "public"."customer_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_account_id_accounts_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cancelled_by_account_id_accounts_id_fk" FOREIGN KEY ("cancelled_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_commands_idempotency" ON "event_commands" USING btree ("property_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_exceptions_occurrence" ON "event_occurrence_exceptions" USING btree ("event_id","occurrence_start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_spaces_property_code" ON "event_spaces" USING btree ("property_id","code");--> statement-breakpoint
CREATE INDEX "idx_events_property_dates" ON "events" USING btree ("property_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_events_property_space" ON "events" USING btree ("property_id","space_id");--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES
  ('events.read', 'Leer eventos y espacios'),
  ('events.create', 'Crear eventos'),
  ('events.update', 'Actualizar eventos'),
  ('events.confirm', 'Confirmar eventos'),
  ('events.cancel', 'Cancelar eventos'),
  ('events.archive', 'Archivar eventos')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";
