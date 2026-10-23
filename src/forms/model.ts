// Derived from a FormDef: the list of fields, the Zod schema for documents.data, computed values and display text.
import { z } from 'zod';
import type { FormType } from '@/lib/refs';
import { FORM_DEFS } from './defs';
import type { ComputeKey, DocData, FieldDef, FieldKind, FormDef } from './types';

export interface FlatField {
  id: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  internal: boolean;
}

/** Every editable field on a form, including table cells and write-in labels, in print order. */
export function flatFields(def: FormDef): FlatField[] {
  const out: FlatField[] = [];
  for (const s of def.sections) {
    const internal = !!s.internal;
    const push = (x: FieldDef) => x.kind !== 'computed' && out.push({ id: x.id, label: x.label, kind: x.kind, options: x.options, internal });
    s.fields?.forEach(push);
    if (s.table) {
      for (const r of s.table.rows) {
        if (r.writeIn) out.push({ id: `${s.table.id}.${r.id}.label`, label: r.label, kind: 'text', internal });
        for (const c of s.table.columns) out.push({ id: `${s.table.id}.${r.id}.${c.id}`, label: `${r.label}: ${c.label}`, kind: r.kind ?? c.kind, options: c.options, internal });
      }
    }
    s.after?.forEach(push);
  }
  return out;
}

const cache = new Map<FormType, { fields: FlatField[]; ids: Set<string>; schema: z.ZodType<DocData> }>();

function valueSchema(x: FlatField) {
  if (x.kind === 'checkbox') return z.boolean().optional();
  const s = z.string().trim().max(x.kind === 'textarea' ? 4000 : 300);
  if (x.kind === 'money' || x.kind === 'percent' || x.kind === 'number') return s.regex(/^[0-9.,$%\s-]*$/, 'Enter a number.').optional();
  if (x.kind === 'date') return s.regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Enter a date.').optional();
  if (x.kind === 'datetime') return s.regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, 'Enter a date and time.').optional();
  if ((x.kind === 'select' || x.kind === 'radio') && x.options) return z.union([z.literal(''), z.enum(x.options as [string, ...string[]])]).optional();
  return s.optional();
}

function model(type: FormType) {
  let m = cache.get(type);
  if (!m) {
    const def = FORM_DEFS[type];
    const fields = flatFields(def);
    const shape: Record<string, z.ZodType> = { doc_date: z.string().trim().max(20).optional() };
    for (const x of fields) shape[x.id] = valueSchema(x);
    // Unknown keys are dropped rather than rejected, so a form can lose a field without breaking old documents.
    m = { fields, ids: new Set(fields.map((x) => x.id).concat('doc_date')), schema: z.object(shape).strip() as unknown as z.ZodType<DocData> };
    cache.set(type, m);
  }
  return m;
}

export const docSchema = (type: FormType) => model(type).schema;
export const fieldIds = (type: FormType) => model(type).ids;
export const formFields = (type: FormType) => model(type).fields;

/** A new document: each field's starting value (State "PA", County "Dauphin", default commission). */
export function emptyData(type: FormType): DocData {
  const out: DocData = {};
  for (const s of FORM_DEFS[type].sections) for (const x of [...(s.fields ?? []), ...(s.after ?? [])]) if (x.initial) out[x.id] = x.initial;
  return out;
}

/** Keeps only values for fields this form has, so one fill map serves every form. Empty values never overwrite. */
export function applyFill(type: FormType, data: DocData, fill: DocData): DocData {
  const ids = fieldIds(type);
  const next = { ...data };
  for (const [k, v] of Object.entries(fill)) if (ids.has(k) && v !== '' && v !== undefined && v !== null) next[k] = v;
  return next;
}

/** Removes brokerage-only sections from a copy shared with a client. */
export function clientCopy(type: FormType, data: DocData): DocData {
  const hidden = new Set(formFields(type).filter((x) => x.internal).map((x) => x.id));
  return Object.fromEntries(Object.entries(data).filter(([k]) => !hidden.has(k)));
}

// ---- Numbers ----

export function parseAmount(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function dollars(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function chunk(x: number): string {
  const s: string[] = [];
  if (x >= 100) {
    s.push(ONES[Math.floor(x / 100)] + ' Hundred');
    x %= 100;
  }
  if (x >= 20) s.push(TENS[Math.floor(x / 10)] + (x % 10 ? '-' + ONES[x % 10] : ''));
  else if (x > 0) s.push(ONES[x]!);
  return s.join(' ');
}

export function numberWords(n: number): string {
  if (n === 0) return 'Zero';
  const out: string[] = [];
  for (let i = 0; n > 0 && i < SCALES.length; i++) {
    const c = n % 1000;
    if (c) out.unshift(chunk(c) + (SCALES[i] ? ' ' + SCALES[i] : ''));
    n = Math.floor(n / 1000);
  }
  return out.join(' ');
}

/** "Two Hundred Seventy-Five Thousand and 00/100 Dollars", as written on cheques and agreements. */
export function moneyWords(v: number): string {
  if (!v) return '—';
  const d = Math.floor(v + 1e-9);
  const c = Math.round((v - d) * 100);
  return `${numberWords(d)} and ${String(c).padStart(2, '0')}/100 Dollars`;
}

export function computeValue(key: ComputeKey, d: DocData): string {
  const n = (k: string) => parseAmount(d[k]);
  const price = n('price');
  switch (key) {
    case 'price_words':
      return moneyWords(price);
    case 'deposit_words':
      return moneyWords(n('deposit'));
    case 'balance':
      return dollars(Math.max(price - n('deposit'), 0));
    case 'price_fmt':
      return dollars(price);
    case 'comm_total_amt':
      return dollars((price * n('comm_total')) / 100);
    case 'comm_side_amt':
      return dollars((price * n('comm_side')) / 100);
    case 'biz_multiple': {
      const profit = n('biz_profit');
      return profit && price ? `${(price / profit).toFixed(1)} × yearly profit` : '—';
    }
    case 'alloc_total': {
      const sum = ['building', 'equipment', 'inventory', 'goodwill'].reduce((a, r) => a + n(`alloc.${r}.amt`), 0);
      if (!sum) return dollars(0);
      return `${dollars(sum)} · ${Math.abs(sum - price) < 1 ? 'matches the price' : 'differs from the price by ' + dollars(Math.abs(sum - price))}`;
    }
    case 'biz_balance':
      return dollars(Math.max(price - n('deposit') - n('sf_amount'), 0));
  }
}

/** How a stored value reads on the printed copy. */
export function displayValue(kind: FieldKind, v: unknown): string {
  if (v === undefined || v === null || v === '') return '';
  if (kind === 'checkbox') return v ? 'Yes' : 'No';
  const s = String(v);
  if (kind === 'money') return dollars(parseAmount(s));
  if (kind === 'percent') return s.replace(/%$/, '') + '%';
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (kind === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    const [day, t] = s.split('T');
    return `${displayValue('date', day)}, ${t}`;
  }
  return s;
}
