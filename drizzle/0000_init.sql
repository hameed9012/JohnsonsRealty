CREATE TYPE "public"."client_kind" AS ENUM('person', 'couple', 'company', 'estate');--> statement-breakpoint
CREATE TYPE "public"."client_role" AS ENUM('buyer', 'seller', 'landlord', 'tenant', 'business_owner');--> statement-breakpoint
CREATE TYPE "public"."deal_side" AS ENUM('buyer', 'seller', 'tenant', 'landlord');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('active', 'under_offer', 'under_contract', 'settlement', 'closed', 'fallen_through');--> statement-breakpoint
CREATE TYPE "public"."disclosure_answer" AS ENUM('yes', 'no', 'unknown', 'na');--> statement-breakpoint
CREATE TYPE "public"."disclosure_item" AS ENUM('roof', 'basement_water', 'foundation', 'heating', 'cooling', 'water_heater', 'plumbing', 'electrical', 'water_sewer', 'wood_insects', 'radon', 'lead_paint', 'fuel_tanks', 'mold', 'pool_spa', 'windows_doors', 'appliances', 'hoa', 'liens_violations', 'flooding');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'sent', 'signed');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'open', 'waiting', 'closed');--> statement-breakpoint
CREATE TYPE "public"."enquiry_type" AS ENUM('showing_request', 'valuation_request', 'general_contact', 'career_application', 'listing_question');--> statement-breakpoint
CREATE TYPE "public"."form_type" AS ENUM('listing_contract', 'disclosure_statement', 'agreement_of_sale', 'agreement_change', 'business_listing', 'earnest_money', 'business_sale', 'settlement_handover');--> statement-breakpoint
CREATE TYPE "public"."listing_purpose" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."listing_source" AS ENUM('agent', 'owner_submitted');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_review', 'changes_requested', 'rejected', 'coming_soon', 'active', 'for_lease', 'under_offer', 'under_contract', 'sold', 'leased', 'off_market', 'withdrawn', 'archived');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('house', 'apartment', 'business', 'land', 'rental');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('guide', 'news');--> statement-breakpoint
CREATE TYPE "public"."price_event" AS ENUM('listed', 'reduced', 'increased', 'sold', 'leased');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'agent', 'client');--> statement-breakpoint
CREATE TYPE "public"."showing_status" AS ENUM('requested', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'deactivated');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"discord_id" text,
	"display_name" text,
	"avatar_url" text,
	"roblox_username" text,
	"chirper_handle" text,
	"role" "role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"onboarded_at" timestamp with time zone,
	"notification_prefs" jsonb DEFAULT '{"savedSearchAlerts":true,"showingUpdates":true,"dealMessages":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"city" text,
	"postal_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"hero_media_id" uuid,
	"police" text,
	"fire" text,
	"school_district" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"selectable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "careers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"body" text DEFAULT '' NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "careers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_id" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer,
	"format" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_id_unique" UNIQUE("storage_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "post_kind" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"body" text DEFAULT '' NOT NULL,
	"hero_media_id" uuid,
	"author_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"brokerage_name" text DEFAULT 'Johnson’s Realty' NOT NULL,
	"brokerage_subline" text DEFAULT 'Brokerage · Pennsylvania' NOT NULL,
	"tagline" text,
	"office_location" text,
	"chirper_handle" text,
	"discord_invite" text,
	"civops_line" text,
	"footer_text" text,
	"about_body" text,
	"hero_media_id" uuid,
	"hero_video_url" text,
	"hero_headline" text,
	"map_media_id" uuid,
	"admins_can_approve" boolean DEFAULT true NOT NULL,
	"live_edits_need_review" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"public_name" text NOT NULL,
	"title" text,
	"bio" text,
	"photo_id" uuid,
	"contact_line" text,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"wide_confidential_access" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "agent_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "client_confidential" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"motivation" text,
	"negotiation_notes" text,
	"relay_lines" text,
	"commission_terms" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"goes_by" text,
	"age_occupation" text,
	"marital_status" text,
	"signs" boolean DEFAULT true NOT NULL,
	"role_label" text,
	"discord" text,
	"roblox_username" text,
	"chirper" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "client_kind" DEFAULT 'person' NOT NULL,
	"display_name" text NOT NULL,
	"legal_name_on_forms" text,
	"roles" "client_role"[] DEFAULT '{}'::client_role[] NOT NULL,
	"user_id" text,
	"agent_id" text,
	"source" text,
	"best_contact" text,
	"emergency_contact" text,
	"business_address" text,
	"currently_occupying" text,
	"mailing_address_after" text,
	"reason" text,
	"timeline" text,
	"who_decides" text,
	"background" text,
	"notes" text,
	"created_by" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_business" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"business_name" text,
	"name_withheld" boolean DEFAULT false NOT NULL,
	"teaser" text,
	"entity" text,
	"signer_capacity" text,
	"business_type" text,
	"opened_year" integer,
	"employees" integer,
	"hours" text,
	"seats" integer,
	"what_is_sold" text,
	"building_size" text,
	"premises_rent" text,
	"premises_lease_end" text,
	"premises_landlord" text,
	"trading_history" text,
	"owner_financing" text,
	"price_building" integer,
	"price_equipment" integer,
	"price_inventory" integer,
	"price_goodwill" integer,
	"included" text,
	"excluded" text,
	"licences" text,
	"training" text,
	"non_compete" text,
	"staff_terms" text,
	"confidential" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_confidential" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"bottom_line" integer,
	"negotiation_rules" text,
	"relay_lines" text,
	"commission_terms" text,
	"yearly_sales" integer,
	"yearly_profit" integer,
	"inventory_value" integer,
	"disclosure_notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_disclosures" (
	"listing_id" uuid NOT NULL,
	"item" "disclosure_item" NOT NULL,
	"answer" "disclosure_answer",
	"detail" text,
	CONSTRAINT "listing_disclosures_listing_id_item_pk" PRIMARY KEY("listing_id","item")
);
--> statement-breakpoint
CREATE TABLE "listing_features" (
	"listing_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	CONSTRAINT "listing_features_listing_id_feature_id_pk" PRIMARY KEY("listing_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "listing_lease_terms" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"lease_length_months" integer,
	"deposit" integer,
	"due_at_signing" text,
	"rent_due" text,
	"late_fee" text,
	"payment_method" text,
	"renewal" text,
	"utilities" text,
	"yard_and_snow" text,
	"max_occupants" integer,
	"pets" text,
	"smoking" text,
	"subletting" text,
	"insurance" text,
	"move_in_inspection" text,
	"leasing_fee" text,
	"income_requirement" text,
	"checks" text,
	"references" text,
	"application_fee" text,
	"decision_time" text
);
--> statement-breakpoint
CREATE TABLE "listing_ownership" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"vesting" text,
	"who_signs" text,
	"bought_on" text,
	"bought_for" integer,
	"owned_since" text,
	"deed_reference" text,
	"mortgage" text,
	"liens" text
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_property_details" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"property_style" text,
	"other_rooms" text,
	"parking" text,
	"basement" text,
	"heating" text,
	"cooling" text,
	"water_heater" text,
	"water_sewer" text,
	"electrical" text,
	"roof" text,
	"windows" text,
	"appliances_provided" text,
	"furnished" text,
	"taxes" text,
	"hoa" text,
	"utilities" text,
	"legal_description" text,
	"zoning" text,
	"occupancy" text
);
--> statement-breakpoint
CREATE TABLE "listing_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb NOT NULL,
	"decision" "review_decision",
	"reviewer_id" text,
	"notes" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "listing_reviews_round_uq" UNIQUE("listing_id","round")
);
--> statement-breakpoint
CREATE TABLE "listing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"status" "revision_status" DEFAULT 'pending' NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewer_id" text,
	"notes" text,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listing_terms" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"agreement_start" date,
	"agreement_end" date,
	"earnest_money_expected" text,
	"target_settlement" text,
	"possession" text,
	"included" text,
	"excluded" text,
	"leased_items" text,
	"transfer_tax" text,
	"title_company" text,
	"attorney" text,
	"home_warranty" text,
	"financing_accepted" text,
	"offer_replies" text,
	"as_is" boolean DEFAULT false NOT NULL,
	"yard_sign" boolean,
	"photos_allowed" boolean,
	"lockbox" boolean,
	"showing_notice" text
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text NOT NULL,
	"slug" text NOT NULL,
	"type" "listing_type" NOT NULL,
	"purpose" "listing_purpose" NOT NULL,
	"source" "listing_source" NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"address_line" text DEFAULT '' NOT NULL,
	"unit" text,
	"area_id" uuid,
	"postal_code" text,
	"parcel_id" text,
	"county" text DEFAULT 'Dauphin' NOT NULL,
	"price" integer,
	"previous_price" integer,
	"beds" integer,
	"baths" numeric(3, 1),
	"sqft" integer,
	"lot" text,
	"year_built" integer,
	"garage" text,
	"description" text,
	"showing_instructions" text,
	"available_from" date,
	"listing_agent_id" text,
	"seller_client_id" uuid,
	"submitted_by_user_id" text,
	"map_x" numeric(5, 2),
	"map_y" numeric(5, 2),
	"owner_contact" jsonb,
	"round" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_ref_no_unique" UNIQUE("ref_no"),
	CONSTRAINT "listings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"event" "price_event" NOT NULL,
	"on" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_confidential" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"offers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_parties" (
	"deal_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"side" "deal_side" NOT NULL,
	CONSTRAINT "deal_parties_deal_id_client_id_pk" PRIMARY KEY("deal_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"agent_id" text,
	"stage" "deal_stage" DEFAULT 'active' NOT NULL,
	"offer_date" date,
	"accepted_date" date,
	"inspection_deadline" date,
	"financing_deadline" date,
	"settlement_date" date,
	"closed_at" timestamp with time zone,
	"notes" text,
	"shared_with_client" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"deal_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_deal_id_user_id_pk" PRIMARY KEY("deal_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_agents" (
	"sale_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"side" "deal_side" NOT NULL,
	CONSTRAINT "sale_agents_sale_id_agent_id_side_pk" PRIMARY KEY("sale_id","agent_id","side")
);
--> statement-breakpoint
CREATE TABLE "sale_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"agent_id" text,
	"rate_percent" numeric(5, 2),
	"amount" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_no" integer NOT NULL,
	"listing_id" uuid NOT NULL,
	"deal_id" uuid,
	"buyer_client_id" uuid,
	"seller_client_id" uuid,
	"price" integer NOT NULL,
	"sold_on" date NOT NULL,
	"settled_on" date,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_no_unique" UNIQUE("sale_no")
);
--> statement-breakpoint
CREATE TABLE "showings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"client_id" uuid,
	"requested_by" text,
	"agent_id" text,
	"requested_for" timestamp with time zone NOT NULL,
	"confirmed_for" timestamp with time zone,
	"status" "showing_status" DEFAULT 'requested' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showings_ref_no_unique" UNIQUE("ref_no")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_clients" (
	"document_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "document_clients_document_id_client_id_pk" PRIMARY KEY("document_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"party" text NOT NULL,
	"typed_name" text NOT NULL,
	"signed_on" date NOT NULL,
	"recorded_by" text,
	CONSTRAINT "document_signatures_party_uq" UNIQUE("document_id","party")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_type" "form_type" NOT NULL,
	"form_no" text NOT NULL,
	"doc_no" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"listing_id" uuid,
	"deal_id" uuid,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"shared_with_client" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_doc_no_unique" UNIQUE("doc_no")
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text NOT NULL,
	"type" "enquiry_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"listing_id" uuid,
	"user_id" text,
	"status" "enquiry_status" DEFAULT 'new' NOT NULL,
	"assignee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_ref_no_unique" UNIQUE("ref_no")
);
--> statement-breakpoint
CREATE TABLE "enquiry_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ref_counters_kind_year_pk" PRIMARY KEY("kind","year")
);
--> statement-breakpoint
CREATE TABLE "saved_homes" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_homes_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"params" jsonb NOT NULL,
	"alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_parent_id_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_map_media_id_media_id_fk" FOREIGN KEY ("map_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_confidential" ADD CONSTRAINT "client_confidential_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_people" ADD CONSTRAINT "client_people_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_business" ADD CONSTRAINT "listing_business_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_confidential" ADD CONSTRAINT "listing_confidential_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_disclosures" ADD CONSTRAINT "listing_disclosures_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_features" ADD CONSTRAINT "listing_features_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_features" ADD CONSTRAINT "listing_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_lease_terms" ADD CONSTRAINT "listing_lease_terms_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_ownership" ADD CONSTRAINT "listing_ownership_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_property_details" ADD CONSTRAINT "listing_property_details_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_reviews" ADD CONSTRAINT "listing_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_terms" ADD CONSTRAINT "listing_terms_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_listing_agent_id_users_id_fk" FOREIGN KEY ("listing_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_client_id_clients_id_fk" FOREIGN KEY ("seller_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_confidential" ADD CONSTRAINT "deal_confidential_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_parties" ADD CONSTRAINT "deal_parties_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_agents" ADD CONSTRAINT "sale_agents_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_agents" ADD CONSTRAINT "sale_agents_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_commissions" ADD CONSTRAINT "sale_commissions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_client_id_clients_id_fk" FOREIGN KEY ("buyer_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_client_id_clients_id_fk" FOREIGN KEY ("seller_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_clients" ADD CONSTRAINT "document_clients_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_clients" ADD CONSTRAINT "document_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_replies" ADD CONSTRAINT "enquiry_replies_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_replies" ADD CONSTRAINT "enquiry_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_homes" ADD CONSTRAINT "saved_homes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_homes" ADD CONSTRAINT "saved_homes_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "client_people_client_idx" ON "client_people" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_agent_idx" ON "clients" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_reviews_pending_idx" ON "listing_reviews" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "listing_revisions_listing_idx" ON "listing_revisions" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_area_idx" ON "listings" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "listings_agent_idx" ON "listings" USING btree ("listing_agent_id");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_client_id");--> statement-breakpoint
CREATE INDEX "listings_submitter_idx" ON "listings" USING btree ("submitted_by_user_id");--> statement-breakpoint
CREATE INDEX "price_history_listing_idx" ON "price_history" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_listing_idx" ON "deals" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "messages_deal_idx" ON "messages" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "showings_listing_idx" ON "showings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "showings_agent_idx" ON "showings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "showings_status_idx" ON "showings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_deal_idx" ON "documents" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "documents_listing_idx" ON "documents" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiries_user_idx" ON "enquiries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");