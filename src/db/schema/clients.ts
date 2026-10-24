import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { clientKindEnum, clientRoleEnum } from './enums';
import { createdAt, id, updatedAt } from './_shared';

/**
 * A client file: one party (a person, a couple, a company or an estate) that buys, sells, leases or rents.
 * Fields follow reference/seller-files.md. Confidential fields live in client_confidential.
 */
export const clients = pgTable(
  'clients',
  {
    id: id(),
    kind: clientKindEnum('kind').notNull().default('person'),
    displayName: text('display_name').notNull(),
    /** The name exactly as it goes on forms, e.g. "Hayes Property Holdings LLC". */
    legalNameOnForms: text('legal_name_on_forms'),
    roles: clientRoleEnum('roles').array().notNull().default(sql`'{}'::client_role[]`),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    agentId: text('agent_id').references(() => users.id, { onDelete: 'set null' }),
    /** How they found us. */
    source: text('source'),
    bestContact: text('best_contact'),
    emergencyContact: text('emergency_contact'),
    businessAddress: text('business_address'),
    currentlyOccupying: text('currently_occupying'),
    mailingAddressAfter: text('mailing_address_after'),
    reason: text('reason'),
    timeline: text('timeline'),
    whoDecides: text('who_decides'),
    background: text('background'),
    notes: text('notes'),
    /** Stable key for imported files ("legacy:kowalski"), so re-running the import changes nothing. */
    legacyKey: text('legacy_key').unique(),
    /** e.g. "Spare seller". */
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    /** Set when the seller was generated (a fictional RP seller); Regenerate changes it. */
    generatedSeed: text('generated_seed'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    archived: boolean('archived').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('clients_user_idx').on(t.userId), index('clients_agent_idx').on(t.agentId)],
);

/** The people behind a client file: co-owners, signers, executors and advisers. */
export const clientPeople = pgTable(
  'client_people',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    legalName: text('legal_name').notNull(),
    goesBy: text('goes_by'),
    ageOccupation: text('age_occupation'),
    maritalStatus: text('marital_status'),
    signs: boolean('signs').notNull().default(true),
    /** e.g. "Executor", "Managing member", "Advises, does not sign". */
    roleLabel: text('role_label'),
    discord: text('discord'),
    robloxUsername: text('roblox_username'),
    chirper: text('chirper'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('client_people_client_idx').on(t.clientId)],
);

/** Agents-only notes. Never joined for viewers without confidential access. */
export const clientConfidential = pgTable('client_confidential', {
  clientId: uuid('client_id')
    .primaryKey()
    .references(() => clients.id, { onDelete: 'cascade' }),
  motivation: text('motivation'),
  negotiationNotes: text('negotiation_notes'),
  relayLines: text('relay_lines'),
  commissionTerms: text('commission_terms'),
  updatedAt: updatedAt(),
});
