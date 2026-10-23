import { beforeAll, describe, expect, it } from 'vitest';
import type { DB } from '@/db/client';
import { seedBase } from '@/db/seed-base';
import { areas, features, siteSettings } from '@/db/schema';
import { saleNo } from '@/lib/format';
import { FORMS, formatDocNo, formatRef, formatSaleNumber, nextDocNo, nextRef, nextSaleNo, parseRef } from '@/lib/refs';
import { FORM_TYPES } from '@/db/schema/enums';
import { testDb } from './helpers/db';

describe('number formats', () => {
  it('formats reference numbers as JR-YYYY-NNNNN', () => {
    expect(formatRef(2026, 41)).toBe('JR-2026-00041');
    expect(formatRef(2027, 123456)).toBe('JR-2027-123456');
    expect(parseRef('JR-2026-00041')).toEqual({ year: 2026, n: 41 });
    expect(parseRef('JR-26-1')).toBeNull();
  });
  it('formats sale numbers as Sale No. 001', () => {
    expect(formatSaleNumber(1)).toBe('001');
    expect(saleNo(1)).toBe('Sale No. 001');
    expect(saleNo(1042)).toBe('Sale No. 1042');
  });
  it('has a form number for every form type', () => {
    for (const t of FORM_TYPES) expect(FORMS[t].formNo).toMatch(/^JR-PA-\d{3}$/);
    expect(FORMS.agreement_of_sale.formNo).toBe('JR-PA-100');
    expect(formatDocNo('agreement_of_sale', 2026, 7)).toBe('AOS-2026-0007');
  });
});

describe('counters (Postgres)', () => {
  let db: DB;
  beforeAll(async () => {
    db = await testDb();
  });

  it('issues sequential, unique reference numbers per year', async () => {
    const at = new Date('2026-06-01T00:00:00Z');
    const refs = await Promise.all(Array.from({ length: 25 }, () => nextRef(db, at)));
    expect(new Set(refs).size).toBe(25);
    expect([...refs].sort()[0]).toBe('JR-2026-00001');
    expect([...refs].sort()[24]).toBe('JR-2026-00025');
  });

  it('restarts reference numbers each year', async () => {
    expect(await nextRef(db, new Date('2027-01-01T00:00:00Z'))).toBe('JR-2027-00001');
    expect(await nextRef(db, new Date('2026-12-31T00:00:00Z'))).toBe('JR-2026-00026');
  });

  it('never resets sale numbers', async () => {
    expect(await nextSaleNo(db)).toBe(1);
    expect(await nextSaleNo(db)).toBe(2);
  });

  it('keeps document numbers per form type', async () => {
    const at = new Date('2026-03-01T00:00:00Z');
    expect(await nextDocNo(db, 'agreement_of_sale', at)).toBe('AOS-2026-0001');
    expect(await nextDocNo(db, 'agreement_of_sale', at)).toBe('AOS-2026-0002');
    expect(await nextDocNo(db, 'earnest_money', at)).toBe('EM-2026-0001');
  });

  it('rolls back with the transaction', async () => {
    const at = new Date('2030-01-01T00:00:00Z');
    await expect(
      db.transaction(async (tx) => {
        await nextRef(tx, at);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await nextRef(db, at)).toBe('JR-2030-00001');
  });
});

describe('base seed', () => {
  it('is idempotent and only names areas', async () => {
    const db = await testDb();
    await seedBase(db);
    await seedBase(db);
    const rows = await db.select().from(areas);
    expect(rows).toHaveLength(8);
    const fairview = rows.find((r) => r.slug === 'fairview')!;
    const susq = rows.find((r) => r.slug === 'susquehanna-township')!;
    expect(fairview.parentId).toBe(susq.id);
    expect(fairview.postalCodes).toEqual([]);
    expect(fairview.description).toBeNull();
    expect(await db.select().from(features)).toHaveLength(5);
    const [s] = await db.select().from(siteSettings);
    expect(s!.adminsCanApprove).toBe(true);
  });
});
