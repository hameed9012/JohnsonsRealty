import { z } from 'zod';
import { bool, dollars, halves, int, isoDate, oneOf, text, uuid } from './fields';

export const DEAL_STAGES = ['active', 'under_offer', 'under_contract', 'settlement', 'closed', 'fallen_through'] as const;

export const dealCreateSchema = z.object({
  listingId: uuid('Choose the listing.').refine((v) => v !== null, 'Choose the listing.'),
  clientId: uuid('Choose the client.').refine((v) => v !== null, 'Choose the client.'),
  side: oneOf(['buyer', 'tenant'] as const, 'Choose whether they’re buying or renting.'),
});

export const dealDatesSchema = z.object({
  offerDate: isoDate(),
  acceptedDate: isoDate(),
  inspectionDeadline: isoDate(),
  financingDeadline: isoDate(),
  settlementDate: isoDate(),
  notes: text(4000, 'The notes'),
  sharedWithClient: bool,
});

export const offerSchema = z.object({
  amount: dollars('Enter the offer in dollars, like 355000.').refine((v) => v !== null, 'Enter the offer in dollars, like 355000.'),
  by: oneOf(['buyer', 'seller'] as const, 'Choose who made it.').refine((v) => v !== null, 'Choose who made it.'),
  on: isoDate().refine((v) => v !== null, 'Enter the date, like 2026-10-24.'),
  note: text(500, 'The note'),
});

export const commissionSchema = z.object({
  agentId: z.string().min(1).max(100).nullable(),
  ratePercent: z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v, ctx) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: 'custom', message: 'Enter a rate between 0 and 100, like 2.5.' });
      return z.NEVER;
    }
    return n;
  }),
  amount: dollars('Enter the commission in dollars, like 9125.').refine((v) => v !== null, 'Enter the commission in dollars, like 9125.'),
  note: text(300, 'The note'),
});

export const saleSchema = z.object({
  price: dollars('Enter the sale price in dollars, like 360000.').refine((v) => v !== null, 'Enter the sale price in dollars, like 360000.'),
  soldOn: isoDate('Enter the date, like 2026-10-24.').refine((v) => v !== null, 'Enter the date, like 2026-10-24.'),
  settledOn: isoDate(),
  buyerAgentId: z.string().max(100).nullable().optional(),
  commissions: z.array(commissionSchema).max(6).default([]),
});

export const priceChangeSchema = z.object({
  price: dollars().refine((v) => v !== null && v > 0, 'Enter a price in dollars, like 365000.'),
});

export const liveEditSchema = z.object({
  description: text(5000, 'The description'),
  showingInstructions: text(1000, 'The showing instructions'),
  beds: int('Enter the number of bedrooms, like 3.', 0, 50),
  baths: halves('Enter the number of bathrooms, like 2 or 1.5.'),
  sqft: int('Enter the living space in square feet, like 1850.', 0, 500_000),
});

export const inviteSchema = z.object({
  role: z.enum(['admin', 'agent']),
  note: text(200, 'The note'),
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const replySchema = z.object({
  body: text(4000, 'The reply').refine((v) => v !== null, 'Write a reply first.'),
  internal: bool,
});
