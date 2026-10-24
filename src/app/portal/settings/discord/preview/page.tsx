import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscordPreview } from '@/components/portal/DiscordPreview';
import { Breadcrumbs } from '@/components/ui/layout';
import { db } from '@/db/client';
import { brandContext } from '@/discord/config';
import {
  agentCardMessage,
  announcementMessage,
  applicationMessage,
  dealMessage,
  listingMessage,
  noLongerAvailableMessage,
  openHouseMessage,
  priceReducedMessage,
  reviewPendingMessage,
  soldMessage,
  ticketIntakeMessage,
  type ListingEmbedData,
} from '@/discord/embeds';
import { can } from '@/lib/permissions';
import { requireStaff } from '@/server/session';

export const metadata: Metadata = { title: 'Discord embeds' };

/** Every embed type, with clearly fake sample data, so the Owner can see them before they post. */
export default async function DiscordPreviewPage() {
  const actor = await requireStaff('/portal/settings/discord/preview');
  if (!can(actor, 'settings.manage')) notFound();
  const b = await brandContext(db);
  const sale: ListingEmbedData = {
    kind: 'sale',
    title: 'Example Lane',
    slug: 'example-lane',
    description: 'Example two-storey home with a garden. Close to the example park and shops. Third sentence not shown.',
    coverUrl: `${b.site}/brand/jr-avatar-green.png`,
    price: 760000,
    beds: 4,
    baths: 1.5,
    areaName: 'Example Area',
    postal: '601',
    agentName: 'Example Agent',
    refNo: 'JR-2026-00001',
  };
  const rent: ListingEmbedData = { ...sale, kind: 'rent', title: 'Example Rental', price: 1900, beds: 2, baths: 1 };
  const biz: ListingEmbedData = { ...sale, kind: 'business', title: 'Established example diner', price: 595000, beds: null, baths: null, businessType: 'Restaurant / diner', agentName: null };
  const examples = [
    { label: 'New listing (#new-listings)', message: listingMessage(b, sale, '1') },
    { label: 'Rental (#for-rent)', message: listingMessage(b, rent, '1') },
    { label: 'Business, name withheld (#businesses-for-sale)', message: listingMessage(b, biz, '1') },
    { label: 'Price reduced (#new-listings)', message: priceReducedMessage(b, { ...sale, price: 735000 }, 760000, '1') },
    { label: 'No longer available (edits the original)', message: noLongerAvailableMessage(b, sale) },
    { label: 'Sold (#sold)', message: soldMessage(b, { title: 'Example Lane', saleNo: 'Sale No. 001', price: 752000, rent: false, areaName: 'Example Area', postal: '601', agentName: 'Example Agent', thumbUrl: sale.coverUrl, refNo: sale.refNo }) },
    { label: 'Waiting for review (#listing-review)', message: reviewPendingMessage(b, { title: 'Example Lane', listingId: '00000000-0000-0000-0000-000000000000', submitter: 'Example Agent', source: 'agent', round: 1, thumbUrl: sale.coverUrl, price: '$760,000', refNo: sale.refNo }, '1') },
    { label: 'Deal stage (#deal-board)', message: dealMessage(b, { title: 'Example Lane', dealId: '00000000-0000-0000-0000-000000000000', from: 'Active', to: 'Under Offer', agentName: 'Example Agent', refNo: sale.refNo, tone: 'offer' }) },
    { label: 'Career application (#applications)', message: applicationMessage(b, { enquiryId: '00000000-0000-0000-0000-000000000000', refNo: 'JR-2026-00002', role: 'Example Agent role', applicant: 'Example Applicant', roblox: 'ExampleRbx', why: 'Example reason for applying.' }) },
    { label: 'Announcement (#announcements)', message: announcementMessage(b, { title: 'Example announcement', body: 'Example text with **bold** words.', imageUrl: null, authorName: 'Example Owner' }, '1') },
    { label: 'Open house (#open-houses)', message: openHouseMessage(b, { title: 'Example Lane', slug: 'example-lane', startsAt: new Date('2026-11-07T19:00:00Z'), endsAt: new Date('2026-11-07T21:00:00Z'), notes: 'Example: meet at the gate.', coverUrl: sale.coverUrl, agentName: 'Example Agent', refNo: sale.refNo }) },
    { label: 'Ticket intake (new ticket channel)', message: ticketIntakeMessage(b, { number: '0001', typeLabel: 'Buy', openerId: '1', answers: [{ label: 'Roblox username', value: 'ExampleRbx' }, { label: 'Budget', value: '$400,000' }] }) },
    { label: '/agent', message: agentCardMessage(b, { name: 'Example Agent', title: 'Real Estate Agent', slug: 'example-agent', photoUrl: null, chirper: 'ExampleAgent', activeListings: 3, sales: 5 }) },
  ];
  return (
    <div className="stack-lg">
      <Breadcrumbs items={[{ label: 'Site settings', href: '/portal/settings' }, { label: 'Discord server', href: '/portal/settings/discord' }, { label: 'Embed previews' }]} />
      <div className="page-head">
        <div>
          <span className="label label--brass">Owner</span>
          <h1 className="heading-1">How the bot&apos;s posts look</h1>
          <p className="body muted">Sample data only. Real posts use the listing&apos;s photo, price and agent.</p>
        </div>
      </div>
      <div className="dc-grid">
        {examples.map((e) => (
          <DiscordPreview key={e.label} label={e.label} message={e.message} />
        ))}
      </div>
    </div>
  );
}
