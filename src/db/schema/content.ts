import { boolean, check, integer, numeric, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { postKindEnum } from './enums';
import { createdAt, id, ts, updatedAt } from './_shared';

/** Uploaded images. storage_id is the provider's ID (Cloudinary public ID, or a local path in tests). */
export const media = pgTable('media', {
  id: id(),
  storageId: text('storage_id').notNull().unique(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes'),
  format: text('format'),
  uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

/** One row (id = 1). Everything the public site shows about the brokerage itself. */
export const siteSettings = pgTable(
  'site_settings',
  {
    id: integer('id').primaryKey().default(1),
    brokerageName: text('brokerage_name').notNull().default('Johnson’s Realty'),
    brokerageSubline: text('brokerage_subline').notNull().default('Brokerage · Pennsylvania'),
    tagline: text('tagline'),
    officeLocation: text('office_location'),
    chirperHandle: text('chirper_handle'),
    discordInvite: text('discord_invite'),
    civopsLine: text('civops_line'),
    footerText: text('footer_text'),
    aboutBody: text('about_body'),
    heroMediaId: uuid('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
    heroVideoUrl: text('hero_video_url'),
    heroHeadline: text('hero_headline'),
    mapMediaId: uuid('map_media_id').references(() => media.id, { onDelete: 'set null' }),
    adminsCanApprove: boolean('admins_can_approve').notNull().default(true),
    liveEditsNeedReview: boolean('live_edits_need_review').notNull().default(false),
    /** Days a sold or leased listing stays on the property map. */
    soldOnMapDays: integer('sold_on_map_days').notNull().default(30),
    updatedAt: updatedAt(),
  },
  (t) => [check('site_settings_singleton', sql`${t.id} = 1`)],
);

export const areas = pgTable('areas', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  parentId: uuid('parent_id').references((): AnyPgColumn => areas.id, { onDelete: 'set null' }),
  city: text('city'),
  postalCodes: text('postal_codes').array().notNull().default(sql`'{}'::text[]`),
  description: text('description'),
  heroMediaId: uuid('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
  police: text('police'),
  fire: text('fire'),
  schoolDistrict: text('school_district'),
  displayOrder: integer('display_order').notNull().default(0),
  selectable: boolean('selectable').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Listing features (pool, gate, office…) are data so the Owner can add more. icon is an IconName. */
export const features = pgTable('features', {
  id: id(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  icon: text('icon'),
  displayOrder: integer('display_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const posts = pgTable('posts', {
  id: id(),
  kind: postKindEnum('kind').notNull(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  body: text('body').notNull().default(''),
  heroMediaId: uuid('hero_media_id').references(() => media.id, { onDelete: 'set null' }),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: ts('published_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const careers = pgTable('careers', {
  id: id(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  summary: text('summary'),
  body: text('body').notNull().default(''),
  open: boolean('open').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** In-game postal zones on the map image (centre as % of the image). Each belongs to one area (PARP jurisdictions). */
export const postalZones = pgTable('postal_zones', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  x: numeric('x', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  y: numeric('y', { precision: 5, scale: 2, mode: 'number' }).notNull(),
  areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
