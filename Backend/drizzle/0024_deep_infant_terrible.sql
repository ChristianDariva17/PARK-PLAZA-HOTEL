CREATE TYPE "public"."contract_status" AS ENUM('Borrador', 'Pendiente', 'Vigente', 'Reemplazado', 'Cancelado');--> statement-breakpoint
CREATE TYPE "public"."event_legacy_party" AS ENUM('guest', 'customerAccount', 'both', 'neither');--> statement-breakpoint
CREATE TYPE "public"."event_quarantine_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "contract_evidence_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"relation_type" varchar(64) NOT NULL,
	"linked_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"version_number" varchar(32) NOT NULL,
	"creator_account_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" varchar(255) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"reservation_id" uuid,
	"reference" varchar(128) NOT NULL,
	"status" "contract_status" DEFAULT 'Borrador' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"origin_type" varchar(64) NOT NULL,
	"origin_id" uuid NOT NULL,
	"description" varchar(255) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creator_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "legacy_party_type" "event_legacy_party";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quarantine_status" "event_quarantine_status" DEFAULT 'resolved' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quarantine_resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quarantine_resolved_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "contract_evidence_links" ADD CONSTRAINT "contract_evidence_links_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_evidence_links" ADD CONSTRAINT "contract_evidence_links_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_evidence_links" ADD CONSTRAINT "contract_evidence_links_evidence_id_evidences_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_evidence_links" ADD CONSTRAINT "contract_evidence_links_linked_by_account_id_accounts_id_fk" FOREIGN KEY ("linked_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_creator_account_id_accounts_id_fk" FOREIGN KEY ("creator_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_creator_account_id_accounts_id_fk" FOREIGN KEY ("creator_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_evidence_links_unique" ON "contract_evidence_links" USING btree ("contract_id","evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_contract_number_unique" ON "contract_versions" USING btree ("contract_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_versions_idempotency_unique" ON "contract_versions" USING btree ("property_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_property_reference_unique" ON "contracts" USING btree ("property_id","reference");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_quarantine_resolved_by_account_id_accounts_id_fk" FOREIGN KEY ("quarantine_resolved_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "chk_canonical_party" CHECK (quarantine_status = 'pending' OR ( (guest_id IS NOT NULL AND customer_account_id IS NULL) OR (guest_id IS NULL AND customer_account_id IS NOT NULL) ));