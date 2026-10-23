'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusStamp';
import type { StatusKey } from '@/components/ui/status';
import { useToast } from '@/components/ui/Toaster';
import { bulkListingStatus } from '@/server/actions/ops';

export interface ListingRow {
  id: string;
  href: string;
  publicHref: string | null;
  title: string;
  refNo: string;
  status: StatusKey;
  ownerListed: boolean;
  area: string | null;
  agent: string | null;
  price: string;
  daysOnMarket: number | null;
  updated: string;
}

const BULK = [
  { value: 'under_offer', label: 'Mark under offer' },
  { value: 'active', label: 'Back on the market (sale)' },
  { value: 'for_lease', label: 'Back on the market (rent)' },
  { value: 'off_market', label: 'Take off the market' },
  { value: 'withdrawn', label: 'Withdraw' },
  { value: 'archived', label: 'Archive' },
] as const;

/** Listings table with row selection and bulk status changes. Stacks into cards under 640px. */
export function ListingsTable({ rows }: { rows: ListingRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<string>('');
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="stack">
      <div className="bulk-bar" role="region" aria-label="Bulk actions">
        <label className="jr-check">
          <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all listings" />
          <span>{selected.size ? `${selected.size} selected` : 'Select all'}</span>
        </label>
        <select className="jr-field-input" aria-label="Bulk action" value={action} onChange={(e) => setAction(e.target.value)} disabled={!selected.size}>
          <option value="">Choose an action</option>
          {BULK.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!selected.size || !action}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await bulkListingStatus([...selected], action as never);
              toast({ message: r.message ?? (r.ok ? 'Updated' : 'Couldn’t update'), tone: r.ok && !(r.data && r.data.failed.length) ? 'success' : 'danger' });
              setSelected(new Set());
              router.refresh();
            })
          }
        >
          Apply
        </Button>
      </div>
      <div className="dt-wrap">
        <table className="dt">
          <caption className="sr-only">Listings</caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Property</th>
              <th scope="col">Status</th>
              <th scope="col">Area</th>
              <th scope="col">Agent</th>
              <th scope="col" className="right">
                Price
              </th>
              <th scope="col">On market</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Select">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                </td>
                <td data-label="Property">
                  <Link href={r.href}>{r.title}</Link>
                  <span className="id muted" style={{ display: 'block' }}>
                    {r.refNo}
                  </span>
                </td>
                <td data-label="Status">
                  <span className="row">
                    <StatusPill status={r.status} />
                    {r.ownerListed ? <StatusPill status="listed-by-owner" /> : null}
                  </span>
                </td>
                <td data-label="Area">{r.area ?? '—'}</td>
                <td data-label="Agent">{r.agent ?? '—'}</td>
                <td data-label="Price" className="num right">
                  {r.price}
                </td>
                <td data-label="On market" className="num">
                  {r.daysOnMarket === null ? '—' : `${r.daysOnMarket} d`}
                </td>
                <td data-label="Updated" className="num">
                  {r.updated}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
