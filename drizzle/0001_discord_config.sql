CREATE TABLE "discord_config" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"discord_id" text NOT NULL,
	"parent_id" text,
	"hash" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
