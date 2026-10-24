import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZoneEditor } from '@/components/portal/ZoneEditor';
import { EmptyState } from '@/components/ui/blocks';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { can } from '@/lib/permissions';
import { publicImageUrl } from '@/lib/storage';
import { mapData } from '@/server/map/data';
import { areaOptions, getAreas } from '@/server/queries/areas';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Property map' };

export default async function MapSettingsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const actor = await requireStaff('/portal/settings/map');
  if (!can(actor, 'settings.manage')) notFound();
  const { add } = await searchParams;
  const [data, areas] = await Promise.all([mapData(db), getAreas()]);
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Site settings', href: '/portal/settings' }, { label: 'Property map' }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">Property map</h1>
          <p className="body muted">Listings appear as circles at their postal zone. Move the zones to fine-tune the map; each belongs to an area, which fills in on listings.</p>
        </div>
      </div>
      {data.layout.unplaced.length ? (
        <p className="body-s" role="status">
          Postal codes used by listings but not on the map:{' '}
          {data.layout.unplaced.map((c, i) => (
            <span key={c}>
              {i ? ', ' : ''}
              <Link href={`?add=${c}`}>{c}</Link>
            </span>
          ))}
          .
        </p>
      ) : null}
      {data.image ? (
        <ZoneEditor
          src={publicImageUrl(data.image.storageId, { width: 1600 })}
          width={data.image.width}
          height={data.image.height}
          zones={data.zones}
          areas={areaOptions(areas).map((o) => ({ value: o.value, label: o.label }))}
          soldDays={data.soldDays}
          add={add}
        />
      ) : (
        <EmptyState icon="pin" title="No map image" text="Upload the map of the playable area in Site settings first." action={<Link href="/portal/settings">Site settings</Link>} />
      )}
      <p className="body-s muted">
        The map image is set in <Link href="/portal/settings">Site settings</Link>. The Discord map message and the PNG at <code className="id">/api/map.png</code> update when the map changes.
      </p>
    </div>
  );
}
