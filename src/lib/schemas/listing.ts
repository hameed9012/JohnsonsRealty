// The listing submission, step by step. Drafts save with format checks only; the checklist in
// lib/listing-checklist.ts decides what is still missing before Submit for review.
import { z } from 'zod';
import { DISCLOSURE_ITEMS } from '@/db/schema/enums';
import { bool, dollars, halves, int, isoDate, oneOf, text, uuid, yesNo } from './fields';

export const LISTING_TYPES = ['house', 'apartment', 'business', 'land', 'rental'] as const;
export const PURPOSES = ['sale', 'rent'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const TYPE_LABELS: Record<ListingType, string> = {
  house: 'House',
  apartment: 'Apartment',
  business: 'Business',
  land: 'Land',
  rental: 'Rental home',
};

const thisYear = new Date().getUTCFullYear();

// ---- Step 1: Property ----
export const propertyStep = z.object({
  type: oneOf(LISTING_TYPES, 'Choose what kind of property this is.'),
  purpose: oneOf(PURPOSES, 'Choose for sale or for rent.'),
  addressLine: text(160, 'The address'),
  unit: text(40, 'The unit'),
  areaId: uuid('Choose the area from the list.'),
  postalCode: text(20, 'The ZIP code'),
  postal: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, 'The postal code is numbers only, like 601.')
    .optional()
    .transform((v) => v || undefined),
  parcelId: text(40, 'The parcel ID'),
  beds: int('Enter the number of bedrooms, like 3.', 0, 50),
  baths: halves('Enter the number of bathrooms, like 2 or 1.5.'),
  sqft: int('Enter the living space in square feet, like 1850.', 0, 500_000),
  lot: text(60, 'The lot size'),
  yearBuilt: int(`Enter the year it was built, like 1994.`, 1700, thisYear + 2),
  garage: text(120, 'The garage'),
  featureIds: z.array(z.string().uuid()).max(40).default([]),
  description: text(5000, 'The description'),
  // Home systems for the seller file and documents.
  propertyStyle: text(120),
  otherRooms: text(300),
  parking: text(200),
  basement: text(200),
  heating: text(200),
  cooling: text(200),
  waterHeater: text(200),
  waterSewer: text(200),
  electrical: text(120),
  roof: text(200),
  windows: text(200),
  appliancesProvided: text(300),
  furnished: text(120),
  taxes: text(120),
  hoa: text(200),
  utilities: text(200),
  zoning: text(120),
  occupancy: text(120),
  // Business.
  businessName: text(120, 'The business name'),
  nameWithheld: bool,
  teaser: text(160, 'The public line'),
  businessType: text(120),
  openedYear: int('Enter the year the business opened, like 1995.', 1800, thisYear),
  employees: int('Enter the number of staff, like 9.', 0, 10_000),
  hours: text(200),
  seats: int('Enter the number of seats, like 60.', 0, 10_000),
  whatIsSold: text(200),
  buildingSize: text(200),
  tradingHistory: text(2000, 'The trading history'),
});
export type PropertyStep = z.infer<typeof propertyStep>;

// ---- Step 2: Price and terms ----
export const termsStep = z.object({
  price: dollars(),
  availableFrom: isoDate('Enter the date it’s available, like 2026-11-01.'),
  showingInstructions: text(1000, 'The showing instructions'),
  // Sale listing terms.
  agreementStart: isoDate(),
  agreementEnd: isoDate(),
  earnestMoneyExpected: text(120),
  targetSettlement: text(200),
  possession: text(200),
  included: text(1000),
  excluded: text(1000),
  leasedItems: text(300),
  transferTax: text(200),
  titleCompany: text(200),
  attorney: text(200),
  homeWarranty: text(200),
  financingAccepted: text(200),
  offerReplies: text(120),
  asIs: bool,
  yardSign: yesNo,
  photosAllowed: yesNo,
  lockbox: yesNo,
  showingNotice: text(200),
  // Rentals.
  leaseLengthMonths: int('Enter the lease length in months, like 12.', 1, 120),
  deposit: dollars('Enter the deposit in dollars, like 1900.'),
  dueAtSigning: text(200),
  rentDue: text(120),
  lateFee: text(120),
  paymentMethod: text(120),
  renewal: text(200),
  leaseUtilities: text(300),
  yardAndSnow: text(200),
  maxOccupants: int('Enter the most people who can live there, like 4.', 1, 100),
  pets: text(300),
  smoking: text(120),
  subletting: text(120),
  insurance: text(200),
  moveInInspection: text(200),
  leasingFee: text(200),
  incomeRequirement: text(200),
  checks: text(200),
  references: text(200),
  applicationFee: text(120),
  decisionTime: text(120),
  // Business terms.
  ownerFinancing: text(200),
  priceBuilding: dollars('Enter the building’s share in dollars, like 300000.'),
  priceEquipment: dollars('Enter the equipment’s share in dollars, like 85000.'),
  priceInventory: dollars('Enter the inventory’s share in dollars, like 10000.'),
  priceGoodwill: dollars('Enter goodwill in dollars, like 200000.'),
  licences: text(1000),
  training: text(300),
  nonCompete: text(300),
  staffTerms: text(300),
  premisesRent: text(120),
  premisesLeaseEnd: text(120),
  premisesLandlord: text(200),
  businessConfidential: bool,
});
export type TermsStep = z.infer<typeof termsStep>;

// ---- Step 4: Seller ----
export const personSchema = z.object({
  legalName: text(160, 'The legal name'),
  goesBy: text(80),
  ageOccupation: text(160),
  maritalStatus: text(160),
  signs: bool,
  roleLabel: text(120),
  discord: text(60),
  robloxUsername: text(40),
  chirper: text(40),
});

export const CLIENT_KINDS = ['person', 'couple', 'company', 'estate'] as const;

export const clientSchema = z.object({
  kind: oneOf(CLIENT_KINDS, 'Choose who the seller is.'),
  displayName: text(160, 'The client name'),
  legalNameOnForms: text(300),
  source: text(200),
  bestContact: text(300),
  emergencyContact: text(300),
  businessAddress: text(300),
  currentlyOccupying: text(200),
  mailingAddressAfter: text(300),
  reason: text(500),
  timeline: text(300),
  whoDecides: text(300),
  background: text(2000),
  people: z.array(personSchema).max(8).default([]),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const clientConfidentialSchema = z.object({
  motivation: text(2000),
  negotiationNotes: text(4000),
  relayLines: text(4000),
  commissionTerms: text(500),
});

export const disclosureSchema = z.object({
  item: z.enum(DISCLOSURE_ITEMS),
  answer: oneOf(['yes', 'no', 'unknown', 'na'] as const, 'Choose Yes, No, Unknown or N/A.'),
  detail: text(1000),
});

export const sellerStep = z.object({
  /** Existing client file, or null to create one from `client`. */
  clientId: uuid('Choose a client file from the list.'),
  client: clientSchema.optional(),
  clientConfidential: clientConfidentialSchema.optional(),
  // Ownership and money (per property).
  vesting: text(300),
  whoSigns: text(300),
  boughtOn: text(60),
  boughtFor: dollars('Enter what they paid in dollars, like 162000.'),
  ownedSince: text(60),
  deedReference: text(120),
  mortgage: text(200),
  liens: text(300),
  disclosures: z.array(disclosureSchema).max(DISCLOSURE_ITEMS.length).default([]),
  // Listing confidential.
  bottomLine: dollars('Enter the lowest price in dollars, like 350000.'),
  negotiationRules: text(4000),
  relayLines: text(4000),
  commissionTerms: text(500),
  yearlySales: dollars('Enter yearly sales in dollars, like 780000.'),
  yearlyProfit: dollars('Enter yearly profit in dollars, like 165000.'),
  inventoryValue: dollars('Enter the inventory value in dollars, like 10000.'),
  disclosureNotes: text(2000),
});
export type SellerStep = z.infer<typeof sellerStep>;

// ---- Owner-submitted (client account) ----
export const ownerContactSchema = z.object({
  discord: bool,
  roblox: bool,
  chirper: bool,
});

export const ownerDetailsStep = z.object({
  legalName: text(160, 'Your name'),
  coOwners: text(300),
  bestContact: text(300),
  reason: text(500),
  timeline: text(300),
  ownerContact: ownerContactSchema,
});
export type OwnerDetailsStep = z.infer<typeof ownerDetailsStep>;

// ---- Photos ----
export const photoMetaSchema = z.object({
  id: z.string().uuid(),
  alt: text(200, 'The description'),
  caption: text(200, 'The caption'),
});

export const photoOrderSchema = z.object({
  order: z.array(z.string().uuid()).max(60),
  coverId: z.string().uuid().nullable(),
});

export const uploadedSchema = z.object({
  storageId: z.string().min(1).max(300),
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  bytes: z.number().int().nonnegative().optional(),
  format: z.string().max(10).optional(),
  version: z.number().int().optional(),
  signature: z.string().max(100).optional(),
});

export const DISCLOSURE_LABELS: Record<(typeof DISCLOSURE_ITEMS)[number], { label: string; hint: string }> = {
  roof: { label: 'Roof', hint: 'Age, type, repairs' },
  basement_water: { label: 'Basement and water leakage', hint: 'Any water, sump pump' },
  foundation: { label: 'Foundation and structure', hint: 'Cracks, repairs' },
  heating: { label: 'Heating system', hint: 'Type, age' },
  cooling: { label: 'Air conditioning', hint: 'Type, age' },
  water_heater: { label: 'Water heater', hint: 'Size, fuel, age' },
  plumbing: { label: 'Plumbing', hint: 'Pipe type, repairs' },
  electrical: { label: 'Electrical system', hint: 'Service size' },
  water_sewer: { label: 'Water supply and sewer', hint: 'Public or private' },
  wood_insects: { label: 'Wood-destroying insects (termites)', hint: 'Inspections, treatment' },
  radon: { label: 'Radon', hint: 'Tested? Result' },
  lead_paint: { label: 'Lead-based paint (homes built before 1978)', hint: 'Known paint, reports' },
  fuel_tanks: { label: 'Fuel or oil tanks', hint: 'Location, age' },
  mold: { label: 'Mold', hint: 'Where, remediation' },
  pool_spa: { label: 'Pool or spa', hint: 'Heater, repairs' },
  windows_doors: { label: 'Windows, doors and garage doors', hint: 'Condition' },
  appliances: { label: 'Included appliances', hint: 'Working order' },
  hoa: { label: 'HOA or planned community', hint: 'Name, fees' },
  liens_violations: { label: 'Liens, code violations or legal actions', hint: 'Details' },
  flooding: { label: 'Flooding or drainage', hint: 'Details' },
};

export const STEPS = [
  { key: 'property', label: 'Property' },
  { key: 'terms', label: 'Price and terms' },
  { key: 'photos', label: 'Photos' },
  { key: 'seller', label: 'Seller' },
  { key: 'review', label: 'Review and submit' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];

export const OWNER_STEPS = [
  { key: 'property', label: 'Property' },
  { key: 'terms', label: 'Price' },
  { key: 'photos', label: 'Photos' },
  { key: 'owner', label: 'Your details' },
  { key: 'review', label: 'Review and submit' },
] as const;

export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested', 'rejected']),
    notes: text(4000, 'The notes'),
    comingSoon: bool,
    agentId: z.string().max(100).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.decision !== 'approved' && !v.notes) {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Add a note so the submitter knows what to change.' });
    }
  });
