// Reference, sale and document numbers. Counters live in ref_counters and are incremented with a single
// upsert inside the caller's transaction, so concurrent requests never get the same number.
import { sql } from 'drizzle-orm';
import type { Executor } from '@/db/client';
import { refCounters } from '@/db/schema';
import type { FORM_TYPES } from '@/db/schema/enums';

export type FormType = (typeof FORM_TYPES)[number];

export const FORMS: Record<FormType, { formNo: string; prefix: string; title: string; numberLabel: string }> = {
  listing_contract: { formNo: 'JR-PA-050', prefix: 'LC', title: 'Exclusive Right to Sell Listing Contract', numberLabel: 'Contract No.' },
  disclosure_statement: { formNo: 'JR-PA-060', prefix: 'SPDS', title: 'Seller’s Property Disclosure Statement', numberLabel: 'Statement No.' },
  agreement_of_sale: { formNo: 'JR-PA-100', prefix: 'AOS', title: 'Residential Agreement of Sale', numberLabel: 'Agreement No.' },
  agreement_change: { formNo: 'JR-PA-110', prefix: 'AD', title: 'Change to Agreement of Sale', numberLabel: 'Addendum No.' },
  business_listing: { formNo: 'JR-PA-200', prefix: 'BL', title: 'Business Listing Contract', numberLabel: 'Contract No.' },
  earnest_money: { formNo: 'JR-PA-210', prefix: 'EM', title: 'Earnest Money Receipt', numberLabel: 'Receipt No.' },
  business_sale: { formNo: 'JR-PA-220', prefix: 'BS', title: 'Business Sale Agreement', numberLabel: 'Agreement No.' },
  settlement_handover: { formNo: 'JR-PA-400', prefix: 'SK', title: 'Settlement & Key Handover', numberLabel: 'Confirmation No.' },
};

/** JR-2026-00041 */
export function formatRef(year: number, n: number): string {
  return `JR-${year}-${String(n).padStart(5, '0')}`;
}

/** 001 — rendered as "Sale No. 001" by lib/format. */
export function formatSaleNumber(n: number): string {
  return String(n).padStart(3, '0');
}

/** AOS-2026-0007 */
export function formatDocNo(type: FormType, year: number, n: number): string {
  return `${FORMS[type].prefix}-${year}-${String(n).padStart(4, '0')}`;
}

export function parseRef(ref: string): { year: number; n: number } | null {
  const m = /^JR-(\d{4})-(\d{5,})$/.exec(ref);
  return m ? { year: Number(m[1]), n: Number(m[2]) } : null;
}

/** Atomically takes the next number for (kind, year). Use year 0 for counters that never reset. */
export async function nextCounter(ex: Executor, kind: string, year: number): Promise<number> {
  const rows = await ex
    .insert(refCounters)
    .values({ kind, year, last: 1 })
    .onConflictDoUpdate({ target: [refCounters.kind, refCounters.year], set: { last: sql`${refCounters.last} + 1`, updatedAt: new Date() } })
    .returning({ last: refCounters.last });
  return rows[0]!.last;
}

function yearOf(now: Date) {
  return now.getUTCFullYear();
}

/** One shared sequence per year for listings, showings and enquiries. */
export async function nextRef(ex: Executor, now = new Date()): Promise<string> {
  const y = yearOf(now);
  return formatRef(y, await nextCounter(ex, 'ref', y));
}

export async function nextSaleNo(ex: Executor): Promise<number> {
  return nextCounter(ex, 'sale', 0);
}

export async function nextDocNo(ex: Executor, type: FormType, now = new Date()): Promise<string> {
  const y = yearOf(now);
  return formatDocNo(type, y, await nextCounter(ex, 'doc:' + type, y));
}
