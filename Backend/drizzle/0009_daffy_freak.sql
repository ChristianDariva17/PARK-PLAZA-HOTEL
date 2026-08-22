CREATE TYPE "public"."vehicle_status" AS ENUM('Dentro', 'Fuera', 'Archivado');--> statement-breakpoint
CREATE TABLE "vehicle_registrations" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"stay_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"plate" varchar(20) NOT NULL,
	"brand_model" varchar(100),
	"vehicle_type" varchar(50) NOT NULL,
	"space" varchar(50) NOT NULL,
	"fee" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"status" "vehicle_status" DEFAULT 'Dentro' NOT NULL,
	"entry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exit_at" timestamp with time zone,
	"entry_responsible" varchar(100) NOT NULL,
	"exit_responsible" varchar(100),
	"exit_observation" text,
	"charge_id" varchar(50),
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_registrations" ADD CONSTRAINT "vehicles_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_registrations" ADD CONSTRAINT "vehicles_stay_fkey" FOREIGN KEY ("stay_id","property_id") REFERENCES "public"."stays"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_registrations" ADD CONSTRAINT "vehicles_client_fkey" FOREIGN KEY ("client_id","property_id") REFERENCES "public"."guests"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_registrations" ADD CONSTRAINT "vehicles_room_fkey" FOREIGN KEY ("room_id","property_id") REFERENCES "public"."rooms"("id","property_id") ON DELETE restrict ON UPDATE no action;