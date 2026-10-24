CREATE TABLE "postal_zones" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"x" numeric(5, 2) NOT NULL,
	"y" numeric(5, 2) NOT NULL,
	"area_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "sold_on_map_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "postal" text;--> statement-breakpoint
ALTER TABLE "postal_zones" ADD CONSTRAINT "postal_zones_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;