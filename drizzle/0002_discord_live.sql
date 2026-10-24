ALTER TYPE "public"."enquiry_type" ADD VALUE 'discord_ticket';--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"image_media_id" uuid,
	"ping_role" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"discord_message_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discord_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'failed' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"discord_message_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_user_id" text NOT NULL,
	"user_id" text,
	"display_name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "discord_message_id" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "discord_channel_id" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "discord_user_id" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "transcript_url" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "decision" text;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_houses" ADD CONSTRAINT "open_houses_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_houses" ADD CONSTRAINT "open_houses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "open_houses_listing_idx" ON "open_houses" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "shifts_user_idx" ON "shifts" USING btree ("discord_user_id");