// What still has to be filled in before a listing can be submitted for review. Pure, so the wizard,
// the review page and the server action all agree.

export const MIN_PHOTOS = 3;

export interface ChecklistInput {
  source: 'agent' | 'owner_submitted';
  type: string | null;
  purpose: string | null;
  addressLine: string | null;
  areaId: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  description: string | null;
  availableFrom?: string | null;
  sellerClientId: string | null;
  photos: { alt: string | null }[];
  lease?: { leaseLengthMonths: number | null; deposit: number | null } | null;
  business?: { businessName: string | null; nameWithheld: boolean; teaser: string | null } | null;
}

export type ChecklistStep = 'property' | 'terms' | 'photos' | 'seller' | 'owner';

export interface ChecklistItem {
  step: ChecklistStep;
  field: string;
  message: string;
}

export function photoCountMessage(n: number): string {
  return `Add at least ${MIN_PHOTOS} photos. You have ${n}.`;
}

export function checklist(l: ChecklistInput): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const add = (step: ChecklistStep, field: string, message: string) => out.push({ step, field, message });
  const home = l.type === 'house' || l.type === 'apartment' || l.type === 'rental';
  const rent = l.purpose === 'rent';

  if (!l.type) add('property', 'type', 'Choose what kind of property this is.');
  if (!l.purpose) add('property', 'purpose', 'Choose for sale or for rent.');
  if (!l.addressLine?.trim()) add('property', 'addressLine', 'Add the street address.');
  if (!l.areaId) add('property', 'areaId', 'Choose the area.');
  if (home && l.beds === null) add('property', 'beds', 'Add the number of bedrooms.');
  if (home && l.baths === null) add('property', 'baths', 'Add the number of bathrooms.');
  if (!l.description || l.description.trim().length < 40) add('property', 'description', 'Write a description of at least 40 characters.');
  if (l.type === 'business') {
    const b = l.business;
    if (!b?.businessName?.trim()) add('property', 'businessName', 'Add the business name. You can still keep it off the public listing.');
    if (b?.nameWithheld && !b.teaser?.trim()) add('property', 'teaser', 'Add the public line shown instead of the name, like “Established diner, Swatara Township”.');
  }

  if (l.price === null || l.price <= 0) add('terms', 'price', rent ? 'Add the monthly rent.' : 'Add the asking price.');
  if (rent) {
    if (!l.availableFrom) add('terms', 'availableFrom', 'Add the date it’s available from.');
    if (!l.lease?.leaseLengthMonths) add('terms', 'leaseLengthMonths', 'Add the lease length.');
    if (l.lease?.deposit === null || l.lease?.deposit === undefined) add('terms', 'deposit', 'Add the security deposit.');
  }

  if (l.photos.length < MIN_PHOTOS) add('photos', 'photos', photoCountMessage(l.photos.length));
  const noAlt = l.photos.filter((p) => !p.alt?.trim()).length;
  if (noAlt) add('photos', 'alt', noAlt === 1 ? 'Describe 1 photo for people using screen readers.' : `Describe ${noAlt} photos for people using screen readers.`);

  // An agent may skip the Seller step: a fictional RP seller is generated when the Owner approves.
  if (!l.sellerClientId && l.source !== 'agent') add('owner', 'sellerClientId', 'Add your details.');
  return out;
}
