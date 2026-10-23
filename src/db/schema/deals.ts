import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { clients } from './clients';
import { dealSideEnum, dealStageEnum, showingStatusEnum } from './enums';
import { listings } from './listings';
import { createdAt, id, ts, updatedAt } from './_shared';

export const deals = pgTable(
  'deals',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'restrict' }),
    agentId: text('agent_id').references(() => users.id, { onDelete: 'set null' }),
    stage: dealStageEnum('stage').notNull().default('active'),
    offerDate: date('offer_date'),
    acceptedDate: date('accepted_date'),
    inspectionDeadline: date('inspection_deadline'),
    financingDeadline: date('financing_deadline'),
    settlementDate: date('settlement_date'),
    closedAt: ts('closed_at'),
    notes: text('notes'),
    sharedWithClient: boolean('shared_with_client').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('deals_stage_idx').on(t.stage), index('deals_listing_idx').on(t.listingId)],
);

export const dealParties = pgTable(
  'deal_parties',
  {
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    side: dealSideEnum('side').notNull(),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.clientId] })],
);

export type OfferEntry = { on: string; amount: number; by: 'buyer' | 'seller'; note?: string };

/** Offer amounts and private deal notes. Agents only. */
export const dealConfidential = pgTable('deal_confidential', {
  dealId: uuid('deal_id')
    .primaryKey()
    .references(() => deals.id, { onDelete: 'cascade' }),
  offers: jsonb('offers').$type<OfferEntry[]>().notNull().default([]),
  notes: text('notes'),
  updatedAt: updatedAt(),
});

export const showings = pgTable(
  'showings',
  {
    id: id(),
    refNo: text('ref_no').notNull().unique(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    requestedBy: text('requested_by').references(() => users.id, { onDelete: 'set null' }),
    agentId: text('agent_id').references(() => users.id, { onDelete: 'set null' }),
    requestedFor: ts('requested_for').notNull(),
    confirmedFor: ts('confirmed_for'),
    status: showingStatusEnum('status').notNull().default('requested'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('showings_listing_idx').on(t.listingId), index('showings_agent_idx').on(t.agentId), index('showings_status_idx').on(t.status)],
);

export const sales = pgTable('sales', {
  id: id(),
  saleNo: integer('sale_no').notNull().unique(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'restrict' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  buyerClientId: uuid('buyer_client_id').references(() => clients.id, { onDelete: 'set null' }),
  sellerClientId: uuid('seller_client_id').references(() => clients.id, { onDelete: 'set null' }),
  price: integer('price').notNull(),
  soldOn: date('sold_on').notNull(),
  settledOn: date('settled_on'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
});

export const saleAgents = pgTable(
  'sale_agents',
  {
    saleId: uuid('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    side: dealSideEnum('side').notNull(),
  },
  (t) => [primaryKey({ columns: [t.saleId, t.agentId, t.side] })],
);

/** Commission splits. Confidential. */
export const saleCommissions = pgTable('sale_commissions', {
  id: id(),
  saleId: uuid('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => users.id, { onDelete: 'set null' }),
  ratePercent: numeric('rate_percent', { precision: 5, scale: 2, mode: 'number' }),
  amount: integer('amount').notNull(),
  note: text('note'),
});

export const messages = pgTable(
  'messages',
  {
    id: id(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_deal_idx').on(t.dealId, t.createdAt)],
);

export const messageReads = pgTable(
  'message_reads',
  {
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadAt: ts('last_read_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.dealId, t.userId] })],
);
