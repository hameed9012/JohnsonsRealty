// House number and date formats from the brand book: $365,000 · $1,900/mo · 1,850 sq ft · Oct 21, 2026.

export function money(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return '$' + Math.round(v).toLocaleString('en-US');
  return String(v);
}

export function rent(v: number): string {
  return money(v) + '/mo';
}

export function sqft(v: number): string {
  return Math.round(v).toLocaleString('en-US') + ' sq ft';
}

export function count(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

const UI_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const DOC_DATE = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00Z' : d) : d;
}

/** Oct 21, 2026 — UI dates. */
export function date(d: Date | string | null | undefined): string {
  return d ? UI_DATE.format(toDate(d)) : '';
}

/** October 21, 2026 — document dates. */
export function docDate(d: Date | string | null | undefined): string {
  return d ? DOC_DATE.format(toDate(d)) : '';
}

export function time(d: Date | string | null | undefined): string {
  return d ? TIME.format(toDate(d)) : '';
}

/** Sale No. 001 */
export function saleNo(n: number): string {
  return 'Sale No. ' + String(n).padStart(3, '0');
}

/** Whole days since a date (days on market). */
export function daysSince(d: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}
