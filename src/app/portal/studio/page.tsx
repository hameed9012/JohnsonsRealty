import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import type { StudioData } from '@/components/studio/Artboards';
import { StudioEditor } from '@/components/studio/StudioEditor';
import { db } from '@/db/client';
import { agentProfiles, users } from '@/db/schema';
import { siteUrl } from '@/lib/discord';
import { count, money } from '@/lib/format';
import { isPublic, type ListingStatus } from '@/lib/listing-status';
import { publicImageUrl } from '@/lib/storage';
import { loadBundle } from '@/server/listings/bundle';
import { studioDataFrom } from '@/server/listings/studio';
import { listingOptions } from '@/server/queries/documents';
import { ledgerFigures } from '@/server/queries/sales';
import { requireStaff } from '@/server/session';
import { getSettings } from '@/server/settings';

export const metadata: Metadata = { title: 'Marketing studio' };

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ listing?: string }> }) {
  const actor = await requireStaff('/portal/studio');
  const { listing } = await searchParams;
  const [settings, options, ledger, profile, user] = await Promise.all([
    getSettings(),
    listingOptions(actor),
    ledgerFigures(),
    db.query.agentProfiles.findFirst({ where: eq(agentProfiles.userId, actor.id) }),
    db.query.users.findFirst({ where: eq(users.id, actor.id), columns: { chirperHandle: true } }),
  ]);
  // Agents only make graphics for listings they can see in the portal; the picker lists exactly those.
  const allowed = listing && options.some((o) => o.value === listing) ? listing : '';
  const b = allowed ? await loadBundle(db, allowed, { confidential: false }) : null;
  const brand = { brokerageName: settings.brokerageName, brokerageSubline: settings.brokerageSubline, tagline: settings.tagline, chirperHandle: settings.chirperHandle };
  const me: StudioData['agent'] = { name: profile?.publicName ?? actor.displayName, title: profile?.title ?? 'Real Estate Agent', chirper: user?.chirperHandle ?? '', contact: profile?.contactLine ?? actor.robloxUsername ?? '' };
  const studio = b ? await studioDataFrom(b, brand) : null;
  const blank: StudioData = { stamp: 'listed', date: '', address: '', areaLine: '', stats: [], blurb: '', price: '', showPrice: false, represented: 'The sellers', photos: [], agent: me, brokerage: { subline: settings.brokerageSubline, tagline: settings.tagline ?? '', chirper: settings.chirperHandle ?? '' } };
  const figures = [
    { value: count(ledger.sold), label: 'Homes sold', n: ledger.sold },
    { value: money(ledger.volume), label: 'Total volume', n: ledger.volume },
    { value: count(ledger.active), label: 'Active listings', n: ledger.active },
  ]
    .filter((f) => f.n > 0)
    .map(({ value, label }) => ({ value, label }));

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="label label--brass">Marketing studio</span>
          <h1 className="heading-1">Marketing studio</h1>
          <p className="body muted">Pick a listing and the brochure fills itself in from it. Change anything before you save the image.</p>
        </div>
      </div>
      <StudioEditor
        key={allowed || 'none'}
        listingId={allowed}
        listingOptions={options}
        initial={studio?.data ?? blank}
        photos={b ? b.photos.map((p) => publicImageUrl(p.media.storageId, { width: 1400 })) : []}
        me={me}
        figures={figures}
        chirp={b && studio && isPublic(b.status as ListingStatus) ? { ...studio.chirp, url: siteUrl(`/property/${b.slug}`) } : b && studio ? { ...studio.chirp, url: siteUrl('/') } : null}
      />
    </div>
  );
}
