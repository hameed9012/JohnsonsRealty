import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { media } from './content';
import { createdAt, id, updatedAt } from './_shared';

/** Public agent profile for staff members (Owner, Admin, Agent). */
export const agentProfiles = pgTable('agent_profiles', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  publicName: text('public_name').notNull(),
  title: text('title'),
  bio: text('bio'),
  photoId: uuid('photo_id').references(() => media.id, { onDelete: 'set null' }),
  contactLine: text('contact_line'),
  active: boolean('active').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  wideConfidentialAccess: boolean('wide_confidential_access').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

