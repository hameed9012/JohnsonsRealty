import { boolean, date, index, integer, jsonb, numeric, pgTable, primaryKey, text, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { clients } from './clients';
import { areas, features, media } from './content';
import {
  disclosureAnswerEnum,
  disclosureItemEnum,
  listingPurposeEnum,
  listingSourceEnum,
  listingStatusEnum,
  listingTypeEnum,
  priceEventEnum,
  reviewDecisionEnum,
  revisionStatusEnum,
} from './enums';
import { createdAt, id, ts, updatedAt } from './_shared';

export const listings = pgTable(
  'listings',
  {
    id: id(),
    refNo: text('ref_no').notNull().unique(),
    slug: text('slug').notNull().unique(),
    type: listingTypeEnum('type').notNull(),
    purpose: listingPurposeEnum('purpose').notNull(),
    source: listingSourceEnum('source').notNull(),
    status: listingStatusEnum('status').notNull().default('draft'),
    addressLine: text('address_line').notNull().default(''),
    unit: text('unit'),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
    /** ZIP code (17101…), used by forms and areas. */
    postalCode: text('postal_code'),
    /** In-game postal code (6012 → 601): places the listing on the property map. */
    postal: text('postal'),
    parcelId: text('parcel_id'),
    county: text('county').notNull().default('Dauphin'),
    /** Asking price in dollars, or monthly rent for purpose = rent. */
    price: integer('price'),
    previousPrice: integer('previous_price'),
    beds: integer('beds'),
    baths: numeric('baths', { precision: 3, scale: 1, mode: 'number' }),
    sqft: integer('sqft'),
    lot: text('lot'),
    yearBuilt: integer('year_built'),
    garage: text('garage'),
    description: text('description'),
    showingInstructions: text('showing_instructions'),
    availableFrom: date('available_from'),
    listingAgentId: text('listing_agent_id').references(() => users.id, { onDelete: 'set null' }),
    sellerClientId: uuid('seller_client_id').references(() => clients.id, { onDelete: 'set null' }),
    submittedByUserId: text('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Manual map pin as percentages of the uploaded map image. Never guessed. */
    mapX: numeric('map_x', { precision: 5, scale: 2, mode: 'number' }),
    mapY: numeric('map_y', { precision: 5, scale: 2, mode: 'number' }),
    /** Owner-submitted listings choose which of their handles show publicly. */
    ownerContact: jsonb('owner_contact').$type<{ discord?: boolean; roblox?: boolean; chirper?: boolean }>(),
    round: integer('round').notNull().default(0),
    featured: boolean('featured').notNull().default(false),
    publishedAt: ts('published_at'),
    withdrawnAt: ts('withdrawn_at'),
    /** The listing's announcement in Discord, edited later (price cut, sold, withdrawn) instead of re-posting. */
    /** Imported listings without 3 photos: Active but hidden from the public site until the photos are in. */
    photosHold: boolean('photos_hold').notNull().default(false),
    discordMessageId: text('discord_message_id'),
    discordChannelId: text('discord_channel_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('listings_status_idx').on(t.status),
    index('listings_area_idx').on(t.areaId),
    index('listings_agent_idx').on(t.listingAgentId),
    index('listings_seller_idx').on(t.sellerClientId),
    index('listings_submitter_idx').on(t.submittedByUserId),
  ],
);

export const listingFeatures = pgTable(
  'listing_features',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.featureId] })],
);

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
    alt: text('alt').notNull().default(''),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    isCover: boolean('is_cover').notNull().default(false),
  },
  (t) => [index('listing_photos_listing_idx').on(t.listingId)],
);

/** Home systems and running costs (seller-files "Property"). */
export const listingPropertyDetails = pgTable('listing_property_details', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  propertyStyle: text('property_style'),
  otherRooms: text('other_rooms'),
  parking: text('parking'),
  basement: text('basement'),
  heating: text('heating'),
  cooling: text('cooling'),
  waterHeater: text('water_heater'),
  waterSewer: text('water_sewer'),
  electrical: text('electrical'),
  roof: text('roof'),
  windows: text('windows'),
  appliancesProvided: text('appliances_provided'),
  furnished: text('furnished'),
  taxes: text('taxes'),
  hoa: text('hoa'),
  utilities: text('utilities'),
  legalDescription: text('legal_description'),
  zoning: text('zoning'),
  occupancy: text('occupancy'),
});

/** Seller-files "Ownership and money". Per property, since one client can own several. */
export const listingOwnership = pgTable('listing_ownership', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  vesting: text('vesting'),
  whoSigns: text('who_signs'),
  boughtOn: text('bought_on'),
  boughtFor: integer('bought_for'),
  ownedSince: text('owned_since'),
  deedReference: text('deed_reference'),
  mortgage: text('mortgage'),
  liens: text('liens'),
});

/** Seller-files "Listing terms" and "Showings". */
export const listingTerms = pgTable('listing_terms', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  agreementStart: date('agreement_start'),
  agreementEnd: date('agreement_end'),
  earnestMoneyExpected: text('earnest_money_expected'),
  targetSettlement: text('target_settlement'),
  possession: text('possession'),
  included: text('included'),
  excluded: text('excluded'),
  leasedItems: text('leased_items'),
  transferTax: text('transfer_tax'),
  titleCompany: text('title_company'),
  attorney: text('attorney'),
  homeWarranty: text('home_warranty'),
  financingAccepted: text('financing_accepted'),
  offerReplies: text('offer_replies'),
  asIs: boolean('as_is').notNull().default(false),
  yardSign: boolean('yard_sign'),
  photosAllowed: boolean('photos_allowed'),
  lockbox: boolean('lockbox'),
  showingNotice: text('showing_notice'),
  /** Furnished option: the total price with the furniture (e.g. the Hartmanns' $795,000). */
  furnishedPrice: integer('furnished_price'),
});

/** Seller-files "Lease terms" and "What he needs from an applicant". */
export const listingLeaseTerms = pgTable('listing_lease_terms', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  leaseLengthMonths: integer('lease_length_months'),
  deposit: integer('deposit'),
  dueAtSigning: text('due_at_signing'),
  rentDue: text('rent_due'),
  lateFee: text('late_fee'),
  paymentMethod: text('payment_method'),
  renewal: text('renewal'),
  utilities: text('utilities'),
  yardAndSnow: text('yard_and_snow'),
  maxOccupants: integer('max_occupants'),
  pets: text('pets'),
  smoking: text('smoking'),
  subletting: text('subletting'),
  insurance: text('insurance'),
  moveInInspection: text('move_in_inspection'),
  leasingFee: text('leasing_fee'),
  incomeRequirement: text('income_requirement'),
  checks: text('checks'),
  references: text('references'),
  applicationFee: text('application_fee'),
  decisionTime: text('decision_time'),
});

/** Business listings. Sales and profit are confidential-by-default and live in listing_confidential. */
export const listingBusiness = pgTable('listing_business', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  businessName: text('business_name'),
  nameWithheld: boolean('name_withheld').notNull().default(false),
  /** Public line when the name is withheld: "Established diner, Swatara Township". */
  teaser: text('teaser'),
  entity: text('entity'),
  signerCapacity: text('signer_capacity'),
  businessType: text('business_type'),
  openedYear: integer('opened_year'),
  employees: integer('employees'),
  hours: text('hours'),
  seats: integer('seats'),
  whatIsSold: text('what_is_sold'),
  buildingSize: text('building_size'),
  premisesRent: text('premises_rent'),
  premisesLeaseEnd: text('premises_lease_end'),
  premisesLandlord: text('premises_landlord'),
  /** Public summary of trading history. */
  tradingHistory: text('trading_history'),
  ownerFinancing: text('owner_financing'),
  priceBuilding: integer('price_building'),
  priceEquipment: integer('price_equipment'),
  priceInventory: integer('price_inventory'),
  priceGoodwill: integer('price_goodwill'),
  included: text('included'),
  excluded: text('excluded'),
  licences: text('licences'),
  training: text('training'),
  nonCompete: text('non_compete'),
  staffTerms: text('staff_terms'),
  confidential: boolean('confidential').notNull().default(true),
});

export const listingDisclosures = pgTable(
  'listing_disclosures',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    item: disclosureItemEnum('item').notNull(),
    answer: disclosureAnswerEnum('answer'),
    detail: text('detail'),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.item] })],
);

/** Agents-only: bottom line, negotiation rules, business financials. Never joined without access. */
export const listingConfidential = pgTable('listing_confidential', {
  listingId: uuid('listing_id')
    .primaryKey()
    .references(() => listings.id, { onDelete: 'cascade' }),
  bottomLine: integer('bottom_line'),
  negotiationRules: text('negotiation_rules'),
  relayLines: text('relay_lines'),
  commissionTerms: text('commission_terms'),
  yearlySales: integer('yearly_sales'),
  yearlyProfit: integer('yearly_profit'),
  inventoryValue: integer('inventory_value'),
  disclosureNotes: text('disclosure_notes'),
  /** The least the seller takes for the furniture on a furnished sale. */
  furnitureLowest: integer('furniture_lowest'),
  updatedAt: updatedAt(),
});

export type ReviewSnapshot = Record<string, unknown>;

export const listingReviews = pgTable(
  'listing_reviews',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    round: integer('round').notNull(),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: ts('submitted_at').notNull().defaultNow(),
    snapshot: jsonb('snapshot').$type<ReviewSnapshot>().notNull(),
    decision: reviewDecisionEnum('decision'),
    reviewerId: text('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    decidedAt: ts('decided_at'),
  },
  (t) => [unique('listing_reviews_round_uq').on(t.listingId, t.round), index('listing_reviews_pending_idx').on(t.decision)],
);

/** Pending edits to a live listing, when "live edits need review" is on. The listing stays public unchanged. */
export const listingRevisions = pgTable(
  'listing_revisions',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    changes: jsonb('changes').$type<ReviewSnapshot>().notNull(),
    status: revisionStatusEnum('status').notNull().default('pending'),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: ts('submitted_at').notNull().defaultNow(),
    reviewerId: text('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    decidedAt: ts('decided_at'),
  },
  (t) => [index('listing_revisions_listing_idx').on(t.listingId, t.status)],
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    price: integer('price').notNull(),
    event: priceEventEnum('event').notNull(),
    on: ts('on').notNull().defaultNow(),
  },
  (t) => [index('price_history_listing_idx').on(t.listingId)],
);
