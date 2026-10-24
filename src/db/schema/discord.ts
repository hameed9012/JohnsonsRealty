import { boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { media } from './content';
import { listings } from './listings';
import { createdAt, id, ts, updatedAt } from './_shared';

/**
 * Every Discord object the bot created, by its blueprint key ("role:agent", "channel:new-listings",
 * "message:welcome"). The bot never looks anything up by name at runtime; setup re-runs update these by ID.
 * `hash` is a digest of what was last sent, so unchanged panels are not edited again.
 */
export const discordConfig = pgTable('discord_config', {
  key: text('key').primaryKey(),
  kind: text('kind').notNull(),
  discordId: text('discord_id').notNull(),
  /** For messages: the channel they live in. */
  parentId: text('parent_id'),
  hash: text('hash'),
  updatedAt: updatedAt(),
});

/** Discord posts that failed. Never blocks the website action; shown in the portal with Retry. */
export const discordOutbox = pgTable('discord_outbox', {
  id: id(),
  event: text('event').notNull(),
  /** What to send: channel key, message body, and the listing to remember the message on. */
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('failed'),
  attempts: integer('attempts').notNull().default(1),
  error: text('error'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Clock in / out from #shifts. user_id is set when the Discord account is linked to a site account. */
export const shifts = pgTable(
  'shifts',
  {
    id: id(),
    discordUserId: text('discord_user_id').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    startedAt: ts('started_at').notNull(),
    endedAt: ts('ended_at'),
  },
  (t) => [index('shifts_user_idx').on(t.discordUserId)],
);

/** Written and published in the portal; posted to #announcements. */
export const announcements = pgTable('announcements', {
  id: id(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  imageMediaId: uuid('image_media_id').references(() => media.id, { onDelete: 'set null' }),
  pingRole: boolean('ping_role').notNull().default(true),
  publishedAt: ts('published_at'),
  discordMessageId: text('discord_message_id'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Created in the portal, posted to #open-houses and shown on the property page. */
export const openHouses = pgTable(
  'open_houses',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    notes: text('notes'),
    cancelled: boolean('cancelled').notNull().default(false),
    discordMessageId: text('discord_message_id'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('open_houses_listing_idx').on(t.listingId)],
);
