import 'server-only';
import type { IconName } from '@/components/ui/Icon';
import { count, date, money, sqft } from '@/lib/format';
import { displayStatus, type ListingStatus } from '@/lib/listing-status';
import type { FactRow, PhotoView, PropertyView } from '@/lib/listing-view';
import { TYPE_LABELS, type ListingType } from '@/lib/schemas/listing';
import type { ListingBundle } from './bundle';
import { agentName, publicTitle } from './present';

const EVENT_LABEL = { listed: 'Listed', reduced: 'Price reduced', increased: 'Price increased', sold: 'Sold', leased: 'Leased' } as const;

/** Public view model. Uses only public columns; confidential tables are ignored even if loaded. */
export function toPropertyView(b: ListingBundle, now = new Date()): PropertyView {
  const photos: PhotoView[] = b.photos.map((p) => ({
    id: p.id,
    src: p.media.storageId,
    width: p.media.width,
    height: p.media.height,
    alt: p.alt || `Photo of ${publicTitle(b)}`,
    caption: p.caption,
  }));
  const cover = photos.find((_, i) => b.photos[i]!.isCover) ?? photos[0] ?? null;
  const ordered = cover ? [cover, ...photos.filter((p) => p.id !== cover.id)] : photos;
  const isBiz = b.type === 'business';
  const rent = b.purpose === 'rent';

  const stats: PropertyView['stats'] = [];
  if (!isBiz && b.beds !== null) stats.push({ icon: 'bed', value: String(b.beds), label: b.beds === 1 ? 'Bed' : 'Beds' });
  if (!isBiz && b.baths !== null) stats.push({ icon: 'bath', value: String(b.baths), label: b.baths === 1 ? 'Bath' : 'Baths' });
  if (b.sqft) stats.push({ icon: 'area', value: count(b.sqft), label: 'Sq ft' });
  if (b.lot) stats.push({ icon: 'lot', value: b.lot, label: 'Lot' });
  if (b.yearBuilt) stats.push({ icon: 'calendar', value: String(b.yearBuilt), label: 'Built' });
  if (isBiz && b.business?.employees) stats.unshift({ icon: 'users', value: String(b.business.employees), label: 'Staff' });

  const facts: FactRow[] = [];
  const add = (label: string, value: string | number | null | undefined, mono = false) => {
    if (value !== null && value !== undefined && value !== '') facts.push({ label, value: String(value), mono });
  };
  add('Type', TYPE_LABELS[b.type as ListingType]);
  add('Reference', b.refNo, true);
  add('Parcel ID', b.parcelId, true);
  add('Postal code', b.postalCode, true);
  add('County', b.county);
  add('Garage', b.garage);
  add('Style', b.details?.propertyStyle);
  add('Other rooms', b.details?.otherRooms);
  add('Parking', b.details?.parking);
  add('Heating', b.details?.heating);
  add('Cooling', b.details?.cooling);
  add('Basement', b.details?.basement);
  add('Water and sewer', b.details?.waterSewer);
  add('Property taxes', b.details?.taxes);
  add('HOA', b.details?.hoa);
  add('Appliances', b.details?.appliancesProvided);
  add('Furnished', b.details?.furnished);
  if (rent) {
    add('Available from', b.availableFrom ? date(b.availableFrom) : null, true);
    add('Lease length', b.lease?.leaseLengthMonths ? `${b.lease.leaseLengthMonths} months` : null);
    add('Security deposit', b.lease?.deposit ? money(b.lease.deposit) : null, true);
    add('Due at signing', b.lease?.dueAtSigning);
    add('Pets', b.lease?.pets);
    add('Smoking', b.lease?.smoking);
    add('Utilities', b.lease?.utilities);
    add('Most occupants', b.lease?.maxOccupants);
    add('Applicants need', b.lease?.incomeRequirement);
    add('Application fee', b.lease?.applicationFee);
  }
  if (isBiz && b.business) {
    add('Business', b.business.nameWithheld ? 'Name withheld until a confidentiality agreement is signed' : b.business.businessName);
    add('Kind of business', b.business.businessType);
    add('Opened', b.business.openedYear, true);
    add('Hours', b.business.hours);
    add('Seats', b.business.seats);
    add('What’s for sale', b.business.whatIsSold);
    add('Building', b.business.buildingSize);
    add('Trading history', b.business.tradingHistory);
    add('Owner financing', b.business.ownerFinancing);
    add('Training', b.business.training);
  }

  const areaFacts: FactRow[] = [];
  if (b.area) {
    if (b.area.parent) areaFacts.push({ label: 'Town', value: b.area.parent.name });
    if (b.area.postalCodes.length) areaFacts.push({ label: 'Postal codes', value: b.area.postalCodes.join(', '), mono: true });
    if (b.area.police) areaFacts.push({ label: 'Police', value: b.area.police });
    if (b.area.fire) areaFacts.push({ label: 'Fire', value: b.area.fire });
    if (b.area.schoolDistrict) areaFacts.push({ label: 'School district', value: b.area.schoolDistrict });
  }

  const agent = b.agent
    ? {
        name: agentName(b) ?? 'Agent',
        title: b.agent.agentProfile?.title ?? null,
        handle: b.agent.chirperHandle ?? null,
        photo: b.agent.agentProfile?.photo?.storageId ?? null,
        slug: b.agent.agentProfile?.active ? b.agent.agentProfile.slug : null,
      }
    : null;

  let ownerContact: PropertyView['ownerContact'] = null;
  if (b.source === 'owner_submitted') {
    const s = b.submitter;
    const show = b.ownerContact ?? {};
    const lines: { label: string; value: string }[] = [];
    if (show.roblox && s?.robloxUsername) lines.push({ label: 'Roblox', value: s.robloxUsername });
    if (show.chirper && s?.chirperHandle) lines.push({ label: 'Chirper', value: '@' + s.chirperHandle });
    if (show.discord && s?.displayName) lines.push({ label: 'Discord', value: s.displayName });
    ownerContact = { name: s?.displayName ?? 'The owner', lines };
  }

  const cardFacts: PropertyView['cardFacts'] = [];
  if (!isBiz && b.beds !== null) cardFacts.push({ icon: 'bed', text: `${b.beds} bed` });
  if (!isBiz && b.baths !== null) cardFacts.push({ icon: 'bath', text: `${b.baths} bath` });
  if (b.sqft) cardFacts.push({ icon: 'area', text: sqft(b.sqft) });
  if (isBiz && b.business?.businessType) cardFacts.push({ icon: 'office', text: b.business.businessType });
  if (rent && b.lease?.leaseLengthMonths) cardFacts.push({ icon: 'calendar', text: `${b.lease.leaseLengthMonths}-month lease` });

  return {
    id: b.id,
    refNo: b.refNo,
    slug: b.slug,
    title: publicTitle(b),
    areaName: b.area?.name ?? null,
    areaSlug: b.area?.slug ?? null,
    areaParentName: b.area?.parent?.name ?? null,
    postalCode: b.postalCode,
    status: displayStatus({ status: b.status as ListingStatus, publishedAt: b.publishedAt, price: b.price, previousPrice: b.previousPrice }, now),
    rawStatus: b.status,
    purpose: b.purpose,
    type: b.type,
    typeLabel: TYPE_LABELS[b.type as ListingType],
    ownerListed: b.source === 'owner_submitted',
    price: b.price,
    previousPrice: b.previousPrice && b.price && b.previousPrice > b.price ? b.previousPrice : null,
    stats: stats.slice(0, 5),
    facts,
    features: b.features.map((f) => ({ label: f.feature.label, icon: (f.feature.icon as IconName | null) ?? null })),
    description: b.description,
    photos: ordered,
    cover,
    priceHistory: b.priceHistory.map((p) => ({ date: date(p.on), event: EVENT_LABEL[p.event], price: p.price })),
    agent,
    ownerContact,
    areaFacts,
    publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
    cardFacts,
  };
}
