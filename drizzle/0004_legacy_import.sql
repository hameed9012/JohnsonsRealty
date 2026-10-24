ALTER TABLE "clients" ADD COLUMN "legacy_key" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "generated_seed" text;--> statement-breakpoint
ALTER TABLE "listing_confidential" ADD COLUMN "furniture_lowest" integer;--> statement-breakpoint
ALTER TABLE "listing_terms" ADD COLUMN "furnished_price" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "photos_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_legacy_key_unique" UNIQUE("legacy_key");