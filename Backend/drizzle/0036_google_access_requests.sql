CREATE TYPE "public"."account_identity_provider" AS ENUM('google');
--> statement-breakpoint
CREATE TYPE "public"."google_access_request_status" AS ENUM('pending', 'approved', 'rejected');
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE "account_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "provider" "account_identity_provider" NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "email" varchar(254) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "google_access_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "email" varchar(254) NOT NULL,
  "display_name" varchar(200),
  "status" "google_access_request_status" DEFAULT 'pending' NOT NULL,
  "account_id" uuid,
  "reviewed_by_account_id" uuid,
  "reviewed_at" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "google_access_requests" ADD CONSTRAINT "google_access_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "google_access_requests" ADD CONSTRAINT "google_access_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "google_access_requests" ADD CONSTRAINT "google_access_requests_reviewed_by_account_id_fkey" FOREIGN KEY ("reviewed_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "account_identities" ADD CONSTRAINT "account_identities_email_normalized_check" CHECK ("email" = lower(btrim("email")));
--> statement-breakpoint
ALTER TABLE "google_access_requests" ADD CONSTRAINT "google_access_requests_email_normalized_check" CHECK ("email" = lower(btrim("email")));
--> statement-breakpoint
CREATE UNIQUE INDEX "account_identities_provider_subject_unique" ON "account_identities" USING btree ("provider", "provider_subject");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_identities_account_provider_unique" ON "account_identities" USING btree ("account_id", "provider");
--> statement-breakpoint
CREATE UNIQUE INDEX "google_access_requests_subject_unique" ON "google_access_requests" USING btree ("provider_subject");
--> statement-breakpoint
CREATE UNIQUE INDEX "google_access_requests_account_unique" ON "google_access_requests" USING btree ("account_id") WHERE "account_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "google_access_requests_property_status_idx" ON "google_access_requests" USING btree ("property_id", "status", "requested_at");
