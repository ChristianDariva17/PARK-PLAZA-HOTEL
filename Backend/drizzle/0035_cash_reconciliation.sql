CREATE TABLE "cash_counts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "counted_amount" numeric(14, 2) NOT NULL,
  "expected_amount" numeric(14, 2) NOT NULL,
  "difference" numeric(14, 2) NOT NULL,
  "note" varchar(500),
  "counted_by_account_id" uuid NOT NULL,
  "counted_by" varchar(120) NOT NULL,
  "kind" varchar(20) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_commands" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "property_id" uuid NOT NULL,
  "operation" varchar(48) NOT NULL,
  "idempotency_key" uuid NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cash_commands_property_operation_key_unique" UNIQUE("property_id", "operation", "idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_account_property_fkey" FOREIGN KEY ("counted_by_account_id", "property_id") REFERENCES "public"."accounts"("id", "property_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "cash_commands" ADD CONSTRAINT "cash_commands_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cash_counts_session_created_idx" ON "cash_counts" USING btree ("session_id", "created_at");
