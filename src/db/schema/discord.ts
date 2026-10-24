import { pgTable, text } from 'drizzle-orm/pg-core';
import { updatedAt } from './_shared';

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
