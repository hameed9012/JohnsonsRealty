import type { Metadata } from 'next';
import { ListingsTable, type ListingRow } from '@/components/portal/ListingsTable';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/fields';
import { date, daysSince, money } from '@/lib/format';
import { displayStatus, isPublic, LISTING_STATUSES, label, type ListingStatus } from '@/lib/listing-status';
import { WIZARD_STATUSES } from '@/server/listings/service';
import { getAreas } from '@/server/queries/areas';
import { portalListings } from '@/server/queries/listings';
import { staffOptions } from '@/server/queries/review';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Listings' };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireStaff('/portal/listings');
  const sp = await searchParams;
  const status = one(sp.status);
  const source = one(sp.source);
  const agent = one(sp.agent);
  const area = one(sp.area);
  const q = one(sp.q).trim().toLowerCase();
  const [all, areas, staff] = await Promise.all([portalListings(actor), getAreas(), staffOptions()]);
  const rows = all.filter(
    (r) =>
      (!status || (status === 'live' ? isPublic(r.status as ListingStatus) : r.status === status)) &&
      (!source || r.source === source) &&
      (!agent || r.agentId === agent) &&
      (!area || r.areaId === area) &&
      (!q || `${r.addressLine} ${r.refNo}`.toLowerCase().includes(q)),
  );
  const tableRows: ListingRow[] = rows.map((r) => ({
    id: r.id,
    href: WIZARD_STATUSES.includes(r.status) && r.status !== 'pending_review' ? `/portal/listings/${r.id}/edit` : `/portal/listings/${r.id}`,
    publicHref: isPublic(r.status as ListingStatus) ? `/property/${r.slug}` : null,
    title: (r.addressLine || 'Untitled draft') + (r.unit ? `, Unit ${r.unit}` : ''),
    refNo: r.refNo,
    status: displayStatus({ status: r.status as ListingStatus, publishedAt: r.publishedAt, price: r.price, previousPrice: r.previousPrice }),
    ownerListed: r.source === 'owner_submitted',
    area: r.areaName,
    agent: r.agentName,
    price: r.price ? money(r.price) + (r.purpose === 'rent' ? '/mo' : '') : '—',
    daysOnMarket: r.publishedAt && isPublic(r.status as ListingStatus) ? daysSince(r.publishedAt) : null,
    updated: date(r.updatedAt),
  }));
  const filtered = !!(status || source || agent || area || q);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Listings</span>
          <h1 className="heading-1">Listings</h1>
          <p className="body muted">{actor.role === 'agent' ? 'Your listings and drafts.' : 'Every listing in the brokerage.'}</p>
        </div>
        <Button href="/portal/listings/new" icon="key">
          Add listing
        </Button>
      </div>
      <form method="get" className="sold-filters" aria-label="Filter listings">
        <label className="jr-field">
          <span className="jr-field-label">Search</span>
          <input className="jr-field-input" name="q" defaultValue={q} placeholder="Address or reference" />
        </label>
        <SelectField label="Status" name="status" placeholder="Any status" options={[{ value: 'live', label: 'On the site' }, ...LISTING_STATUSES.map((s) => ({ value: s, label: label(s) }))]} defaultValue={status} />
        <SelectField label="Source" name="source" placeholder="Agents and owners" options={[{ value: 'agent', label: 'Agent' }, { value: 'owner_submitted', label: 'Listed by Owner' }]} defaultValue={source} />
        {actor.role !== 'agent' ? (
          <SelectField label="Agent" name="agent" placeholder="Any agent" options={staff.map((s) => ({ value: s.id, label: s.name ?? 'Agent' }))} defaultValue={agent} />
        ) : (
          <SelectField label="Area" name="area" placeholder="Any area" options={areas.filter((a) => a.selectable).map((a) => ({ value: a.id, label: a.name }))} defaultValue={area} />
        )}
        <div className="row">
          <Button type="submit" size="sm" icon="filter">
            Filter
          </Button>
          {filtered ? (
            <Button variant="ghost" size="sm" href="/portal/listings">
              Clear
            </Button>
          ) : null}
        </div>
      </form>
      {tableRows.length ? (
        <ListingsTable rows={tableRows} />
      ) : (
        <EmptyState icon="key" title={filtered ? 'No listings match' : 'No listings yet'} text={filtered ? 'Try clearing a filter.' : 'Start one and it saves as a draft until you submit it.'} action={<Button href="/portal/listings/new">Add listing</Button>} />
      )}
    </div>
  );
}
