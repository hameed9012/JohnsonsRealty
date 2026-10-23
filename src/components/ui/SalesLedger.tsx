import Link from 'next/link';
import type * as React from 'react';
import { money } from '@/lib/format';
import { StatusPill } from './StatusStamp';
import type { StatusKey } from './status';

export interface SaleRow {
  no: string;
  date: string;
  address: string;
  area?: string;
  agent?: string;
  status?: StatusKey;
  price: number;
  /** Addition: links the address to the listing. */
  href?: string;
  [extra: string]: unknown;
}

export interface SalesLedgerProps {
  rows: SaleRow[];
  columns?: ('no' | 'date' | 'property' | 'agent' | 'status' | 'price' | string)[];
  caption?: string;
  total?: number;
  totalLabel?: string;
}

const HEAD: Record<string, string> = { no: 'No.', date: 'Date', property: 'Property', agent: 'Agent', status: 'Status', price: 'Price' };

function cell(c: string, r: SaleRow): React.ReactNode {
  if (c === 'no') return <td className="num" key={c}>{r.no}</td>;
  if (c === 'date') return <td className="num" key={c}>{r.date}</td>;
  if (c === 'property')
    return (
      <td key={c}>
        <span className="jr-ledger-addr">{r.href ? <Link href={r.href}>{r.address}</Link> : r.address}</span>
        {r.area ? <span className="jr-ledger-area">{r.area}</span> : null}
      </td>
    );
  if (c === 'agent') return <td key={c}>{r.agent}</td>;
  if (c === 'status') return <td key={c}>{r.status ? <StatusPill status={r.status} /> : null}</td>;
  if (c === 'price') return <td className="num right" key={c}>{money(r.price)}</td>;
  return <td key={c}>{r[c] as React.ReactNode}</td>;
}

export function SalesLedger({ rows, columns, caption, total, totalLabel }: SalesLedgerProps) {
  const cols = columns || ['no', 'date', 'property', 'agent', 'price'];
  return (
    <div className="jr-ledger-wrap">
      <table className="jr-ledger">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className={c === 'price' ? 'right' : undefined} scope="col">
                {HEAD[c] || c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => cell(c, r))}</tr>
          ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr>
              <td colSpan={cols.length - 1}>{totalLabel || 'Total'}</td>
              <td className="num right">{money(total)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
