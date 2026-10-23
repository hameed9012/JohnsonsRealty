import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { roleEnum, userStatusEnum } from './enums';
import { createdAt, id, ts, updatedAt } from './_shared';

export type NotificationPrefs = { savedSearchAlerts: boolean; showingUpdates: boolean; dealMessages: boolean };

/** Auth.js user, extended with the Discord identity and in-game profile. */
export const users = pgTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name'),
    email: text('email').unique(),
    emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
    image: text('image'),
    discordId: text('discord_id').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    robloxUsername: text('roblox_username'),
    chirperHandle: text('chirper_handle'),
    role: roleEnum('role').notNull().default('client'),
    status: userStatusEnum('status').notNull().default('active'),
    onboardedAt: ts('onboarded_at'),
    notificationPrefs: jsonb('notification_prefs')
      .$type<NotificationPrefs>()
      .notNull()
      .default({ savedSearchAlerts: true, showingUpdates: true, dealMessages: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_role_idx').on(t.role)],
);

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const staffInvites = pgTable('staff_invites', {
  id: id(),
  tokenHash: text('token_hash').notNull().unique(),
  role: roleEnum('role').notNull(),
  note: text('note'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  expiresAt: ts('expires_at').notNull(),
  usedBy: text('used_by').references(() => users.id),
  usedAt: ts('used_at'),
  revokedAt: ts('revoked_at'),
  createdAt: createdAt(),
});
