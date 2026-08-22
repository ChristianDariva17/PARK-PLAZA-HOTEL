CREATE TYPE "public"."pet_status" AS ENUM('Activa', 'Archivada');--> statement-breakpoint
CREATE TABLE "pets" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"stay_id" uuid,
	"client_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"size" varchar(50) NOT NULL,
	"lodging_place" varchar(100) NOT NULL,
	"charge" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"charge_id" varchar(50),
	"charge_applied" boolean DEFAULT false NOT NULL,
	"notes" text,
	"damage_incident_id" varchar(50),
	"status" "pet_status" DEFAULT 'Activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archive_reason" text,
	"reactivated_at" timestamp with time zone,
	"reactivation_reason" text
);
--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_stay_fkey" FOREIGN KEY ("stay_id","property_id") REFERENCES "public"."stays"("id","property_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_client_fkey" FOREIGN KEY ("client_id","property_id") REFERENCES "public"."guests"("id","property_id") ON DELETE restrict ON UPDATE no action;