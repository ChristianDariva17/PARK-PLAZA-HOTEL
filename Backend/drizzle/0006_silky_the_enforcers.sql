CREATE TYPE "public"."cleaning_task_status" AS ENUM('pending', 'in_progress', 'completed', 'approved');--> statement-breakpoint
CREATE TYPE "public"."incident_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('pending', 'assigned', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('cleaning', 'maintenance');--> statement-breakpoint
CREATE TABLE "cleaning_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"operation" varchar(64) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaning_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"status" "cleaning_task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" varchar(100) DEFAULT 'Por asignar' NOT NULL,
	"reason" varchar(255) DEFAULT 'Check-out completado' NOT NULL,
	"observation" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"type" "incident_type" DEFAULT 'cleaning' NOT NULL,
	"reference_id" uuid,
	"description" text NOT NULL,
	"priority" "incident_priority" DEFAULT 'medium' NOT NULL,
	"responsible" varchar(100) DEFAULT 'Por asignar' NOT NULL,
	"status" "incident_status" DEFAULT 'pending' NOT NULL,
	"blocks_room" boolean DEFAULT false NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"solution" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cleaning_commands" ADD CONSTRAINT "cleaning_commands_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_property_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_room_property_fkey" FOREIGN KEY ("room_id","property_id") REFERENCES "public"."rooms"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_property_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_room_property_fkey" FOREIGN KEY ("room_id","property_id") REFERENCES "public"."rooms"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleaning_commands_key_idx" ON "cleaning_commands" USING btree ("property_id","operation","idempotency_key");--> statement-breakpoint
CREATE INDEX "cleaning_tasks_property_status_idx" ON "cleaning_tasks" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "cleaning_tasks_room_idx" ON "cleaning_tasks" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "incidents_property_status_idx" ON "incidents" USING btree ("property_id","status");--> statement-breakpoint
CREATE INDEX "incidents_room_idx" ON "incidents" USING btree ("room_id");