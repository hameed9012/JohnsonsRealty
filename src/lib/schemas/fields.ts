// Field parsers shared by every form. Inputs arrive as strings (or numbers); empty means "not filled in yet",
// which drafts allow. Error copy follows the brand book: say what went wrong and how to fix it.
import { z } from 'zod';

type Raw = string | number | boolean | null | undefined;
const raw = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();

function blank(v: Raw) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Optional text, trimmed, empty → null. */
export const text = (max = 2000, label = 'This') =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const s = String(v).trim();
    if (s.length > max) {
      ctx.addIssue({ code: 'custom', message: `${label} is too long. Keep it under ${max.toLocaleString('en-US')} characters.` });
      return z.NEVER;
    }
    return s;
  });

/** Whole dollars. Accepts "365,000" and "$365000". */
export const dollars = (message = 'Enter a price in dollars, like 365000.', max = 100_000_000) =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const s = String(v).replace(/[$,\s]/g, '');
    if (!/^\d+$/.test(s) || Number(s) > max) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return Number(s);
  });

export const int = (message: string, min = 0, max = 1_000_000) =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const s = String(v).replace(/[,\s]/g, '');
    const n = Number(s);
    if (!/^\d+$/.test(s) || n < min || n > max) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return n;
  });

/** Halves allowed, for bathrooms. */
export const halves = (message: string, max = 50) =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const n = Number(String(v).trim());
    if (!Number.isFinite(n) || n < 0 || n > max || Math.round(n * 2) !== n * 2) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return n;
  });

/** YYYY-MM-DD from a date input. */
export const isoDate = (message = 'Enter a date, like 2026-11-01.') =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s + 'T00:00:00Z'))) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return s;
  });

export const yesNo = raw.transform((v) => {
  if (v === true || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === false || v === 'false' || v === 'no') return false;
  return null;
});

export const bool = raw.transform((v) => v === true || v === 'true' || v === 'on' || v === 'yes');

export const uuid = (message = 'Choose an option from the list.') =>
  raw.transform((v, ctx) => {
    if (blank(v)) return null;
    const s = String(v);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return s;
  });

export function oneOf<const T extends readonly string[]>(values: T, message: string) {
  return raw.transform((v, ctx) => {
    if (blank(v)) return null;
    if (!values.includes(String(v))) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return String(v) as T[number];
  });
}
