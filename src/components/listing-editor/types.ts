import type { ChecklistItem } from '@/lib/listing-checklist';
import type { PropertyView } from '@/lib/listing-view';
import type { IconName } from '@/components/ui/Icon';

export type Str = string;

export interface PropertyValues {
  type: Str;
  purpose: Str;
  addressLine: Str;
  unit: Str;
  areaId: Str;
  postalCode: Str;
  postal: Str;
  parcelId: Str;
  beds: Str;
  baths: Str;
  sqft: Str;
  lot: Str;
  yearBuilt: Str;
  garage: Str;
  featureIds: string[];
  description: Str;
  propertyStyle: Str;
  otherRooms: Str;
  parking: Str;
  basement: Str;
  heating: Str;
  cooling: Str;
  waterHeater: Str;
  waterSewer: Str;
  electrical: Str;
  roof: Str;
  windows: Str;
  appliancesProvided: Str;
  furnished: Str;
  taxes: Str;
  hoa: Str;
  utilities: Str;
  zoning: Str;
  occupancy: Str;
  businessName: Str;
  nameWithheld: boolean;
  teaser: Str;
  businessType: Str;
  openedYear: Str;
  employees: Str;
  hours: Str;
  seats: Str;
  whatIsSold: Str;
  buildingSize: Str;
  tradingHistory: Str;
}

export type TermsValues = Record<
  | 'price'
  | 'availableFrom'
  | 'showingInstructions'
  | 'agreementStart'
  | 'agreementEnd'
  | 'earnestMoneyExpected'
  | 'targetSettlement'
  | 'possession'
  | 'included'
  | 'excluded'
  | 'leasedItems'
  | 'transferTax'
  | 'titleCompany'
  | 'attorney'
  | 'homeWarranty'
  | 'financingAccepted'
  | 'offerReplies'
  | 'yardSign'
  | 'photosAllowed'
  | 'lockbox'
  | 'showingNotice'
  | 'leaseLengthMonths'
  | 'deposit'
  | 'dueAtSigning'
  | 'rentDue'
  | 'lateFee'
  | 'paymentMethod'
  | 'renewal'
  | 'leaseUtilities'
  | 'yardAndSnow'
  | 'maxOccupants'
  | 'pets'
  | 'smoking'
  | 'subletting'
  | 'insurance'
  | 'moveInInspection'
  | 'leasingFee'
  | 'incomeRequirement'
  | 'checks'
  | 'references'
  | 'applicationFee'
  | 'decisionTime'
  | 'ownerFinancing'
  | 'priceBuilding'
  | 'priceEquipment'
  | 'priceInventory'
  | 'priceGoodwill'
  | 'licences'
  | 'training'
  | 'nonCompete'
  | 'staffTerms'
  | 'premisesRent'
  | 'premisesLeaseEnd'
  | 'premisesLandlord',
  Str
> & { asIs: boolean; businessConfidential: boolean };

export interface PersonValues {
  legalName: Str;
  goesBy: Str;
  ageOccupation: Str;
  maritalStatus: Str;
  signs: boolean;
  roleLabel: Str;
  discord: Str;
  robloxUsername: Str;
  chirper: Str;
}

export type ClientValues = Record<
  'kind' | 'displayName' | 'legalNameOnForms' | 'source' | 'bestContact' | 'emergencyContact' | 'businessAddress' | 'currentlyOccupying' | 'mailingAddressAfter' | 'reason' | 'timeline' | 'whoDecides' | 'background' | 'generatedSeed',
  Str
> & { people: PersonValues[] };

export type ClientConfValues = Record<'motivation' | 'negotiationNotes' | 'relayLines' | 'commissionTerms', Str>;

export interface SellerValues {
  clientId: Str;
  client: ClientValues;
  clientConfidential: ClientConfValues;
  vesting: Str;
  whoSigns: Str;
  boughtOn: Str;
  boughtFor: Str;
  ownedSince: Str;
  deedReference: Str;
  mortgage: Str;
  liens: Str;
  disclosures: { item: string; answer: Str; detail: Str }[];
  bottomLine: Str;
  negotiationRules: Str;
  relayLines: Str;
  commissionTerms: Str;
  yearlySales: Str;
  yearlyProfit: Str;
  inventoryValue: Str;
  disclosureNotes: Str;
}

export interface OwnerValues {
  legalName: Str;
  coOwners: Str;
  bestContact: Str;
  reason: Str;
  timeline: Str;
  ownerContact: { discord: boolean; roblox: boolean; chirper: boolean };
}

export interface PhotoValue {
  id: string;
  storageId: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  isCover: boolean;
}

export interface EditorData {
  id: string;
  refNo: string;
  source: 'agent' | 'owner_submitted';
  status: string;
  round: number;
  property: PropertyValues;
  terms: TermsValues;
  seller: SellerValues | null;
  owner: OwnerValues | null;
  photos: PhotoValue[];
  lastReview: { decision: string | null; notes: string | null; round: number; decidedAt: string | null } | null;
  checklist: ChecklistItem[];
  preview: PropertyView;
  editable: boolean;
}

export interface EditorOptions {
  areas: { value: string; label: string; postalCodes: string[] }[];
  /** In-game postal zones; choosing one with an area fills the area. */
  zones: { code: string; label: string; areaId: string | null }[];
  features: { value: string; label: string; icon?: IconName }[];
  clients: { id: string; label: string; client: ClientValues; confidential: ClientConfValues | null }[];
  account?: { displayName: string; robloxUsername: string | null; chirperHandle: string | null };
}
