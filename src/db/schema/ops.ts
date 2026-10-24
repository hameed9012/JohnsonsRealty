import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { clients } from './clients';
import { deals } from './deals';
import { documentStatusEnum, enquiryStatusEnum, enquiryTypeEnum, formTypeEnum } from './enums';
import { listings } from './listings';
import { createdAt, id, ts, updatedAt } from './_shared';

export const documents = pgTable(
  'documents',
  {
    id: id(),
    formType: formTypeEnum('form_type').notNull(),
    /** "JR-PA-100" */
    formNo: text('form_no').notNull(),
    /** Per form type per year, e.g. "AOS-2026-0007". */
    docNo: text('doc_no').notNull().unique(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
    status: documentStatusEnum('status').notNull().default('draft'),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    signedAt: ts('signed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('documents_deal_idx').on(t.dealId), index('documents_listing_idx').on(t.listingId)],
);

export const documentClients = pgTable(
  'document_clients',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.clientId] })],
);

export const documentSignatures = pgTable(
  'document_signatures',
  {
    id: id(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /** "Seller", "Buyer", "Listing agent"… */
    party: text('party').notNull(),
    typedName: text('typed_name').notNull(),
    signedOn: date('signed_on').notNull(),
    recordedBy: text('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [unique('document_signatures_party_uq').on(t.documentId, t.party)],
);

export const enquiries = pgTable(
  'enquiries',
  {
    id: id(),
    refNo: text('ref_no').notNull().unique(),
    type: enquiryTypeEnum('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    status: enquiryStatusEnum('status').notNull().default('new'),
    assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    /** Discord tickets: who opened it, the closing summary and the transcript message link. */
    discordUserId: text('discord_user_id'),
    summary: text('summary'),
    transcriptUrl: text('transcript_url'),
    /** Career applications: set by the Accept / Decline buttons in Discord or the portal. */
    decision: text('decision'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('enquiries_status_idx').on(t.status), index('enquiries_user_idx').on(t.userId)],
);

export const enquiryReplies = pgTable('enquiry_replies', {
  id: id(),
  enquiryId: uuid('enquiry_id')
    .notNull()
    .references(() => enquiries.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  internal: boolean('internal').notNull().default(false),
  createdAt: createdAt(),
});

export const savedHomes = pgTable(
  'saved_homes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const savedSearches = pgTable('saved_searches', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** The parsed Buy/Rent search params object. */
  params: jsonb('params').$type<Record<string, unknown>>().notNull(),
  alerts: boolean('alerts').notNull().default(true),
  createdAt: createdAt(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt)],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: id(),
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    diff: jsonb('diff').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('activity_entity_idx').on(t.entity, t.entityId), index('activity_created_idx').on(t.createdAt)],
);

/** Atomic counters for reference, sale and document numbers. year = 0 for counters that never reset. */
export const refCounters = pgTable(
  'ref_counters',
  {
    kind: text('kind').notNull(),
    year: integer('year').notNull(),
    last: integer('last').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })],
);
