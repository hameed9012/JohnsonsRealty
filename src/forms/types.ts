// A document form is data: sections of fields, optional tables, standard terms and signature parties.
// The Zod schema, the editor, the printable view and "Fill from client file" are all derived from it.
import type { FormType } from '@/lib/refs';

export type FieldKind = 'text' | 'textarea' | 'money' | 'percent' | 'number' | 'date' | 'datetime' | 'select' | 'radio' | 'checkbox' | 'area' | 'computed';

/** Read-only values worked out from other fields (price in words, balance due, commission). */
export type ComputeKey =
  | 'price_words'
  | 'deposit_words'
  | 'balance'
  | 'comm_total_amt'
  | 'comm_side_amt'
  | 'biz_multiple'
  | 'alloc_total'
  | 'biz_balance'
  | 'price_fmt';

/**
 * Field ids are unique within a form. Ids shared across forms (seller_name, prop_address, price…) carry the
 * same meaning everywhere, so one client file fills every form, like data-key did in the old generator.
 */
export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  compute?: ComputeKey;
  /** Grid width out of 12 on desktop. */
  span?: 2 | 3 | 4 | 5 | 6 | 8 | 12;
  placeholder?: string;
  /** Prefilled on a new document. */
  initial?: string;
  mono?: boolean;
}

export interface TableColumn {
  id: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  placeholder?: string;
}

export interface TableRow {
  id: string;
  label: string;
  /** "Other (write in)" rows: the label is a field too. */
  writeIn?: boolean;
  /** Overrides the column kind for this row (the addendum mixes money and dates). */
  kind?: FieldKind;
}

/** Each cell is the field `${table.id}.${row.id}.${column.id}`; a write-in label is `${table.id}.${row.id}.label`. */
export interface TableDef {
  id: string;
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
}

export interface SectionDef {
  title: string;
  note?: string;
  fields?: FieldDef[];
  table?: TableDef;
  /** Fields printed under the table. */
  after?: FieldDef[];
  /** Standard terms, printed as a numbered list: [bold lead, text]. */
  terms?: [string, string][];
  /** A boxed notice under the section: [bold lead, text]. */
  notice?: [string, string];
  /** Brokerage-only. Never shown on the copy shared with a client. */
  internal?: boolean;
  /** Signature blocks for these parties are printed in this section, with an optional statement above. */
  signatures?: { statement?: [string, string]; parties: string[] }[];
}

export interface SignatureDef {
  party: string;
  label: string;
  /** Labelled with the agent's own name. */
  agent?: boolean;
  /** "Second Seller (if any)". Not needed to mark the document signed. */
  optional?: boolean;
}

export interface FormDef {
  type: FormType;
  subtitle: string;
  reference: string;
  /** Label for the date in the header row. */
  dateLabel: string;
  dateKind?: 'date' | 'datetime';
  /** Which deal side the main party is on, for "Fill from client file". */
  kind: 'home' | 'business' | 'any';
  sections: SectionDef[];
  signatures: SignatureDef[];
  /** Receipts and confirmations print their section bars without numbers. */
  unnumbered?: boolean;
  /** "Agreement No." mirrored in the footer, when the form refers to an Agreement of Sale. */
  footerAgreement?: boolean;
}

export type DocValue = string | boolean;
export type DocData = Record<string, DocValue>;
