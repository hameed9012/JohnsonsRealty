import { pgEnum } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['owner', 'admin', 'agent', 'client']);
export const userStatusEnum = pgEnum('user_status', ['active', 'deactivated']);

export const listingTypeEnum = pgEnum('listing_type', ['house', 'apartment', 'business', 'land', 'rental']);
export const listingPurposeEnum = pgEnum('listing_purpose', ['sale', 'rent']);
export const listingSourceEnum = pgEnum('listing_source', ['agent', 'owner_submitted']);
export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'pending_review',
  'changes_requested',
  'rejected',
  'coming_soon',
  'active',
  'for_lease',
  'under_offer',
  'under_contract',
  'sold',
  'leased',
  'off_market',
  'withdrawn',
  'archived',
]);
export const reviewDecisionEnum = pgEnum('review_decision', ['approved', 'changes_requested', 'rejected']);
export const revisionStatusEnum = pgEnum('revision_status', ['pending', 'approved', 'rejected', 'withdrawn']);
export const priceEventEnum = pgEnum('price_event', ['listed', 'reduced', 'increased', 'sold', 'leased']);

/** The 20 condition items on Form JR-PA-060, in form order. */
export const DISCLOSURE_ITEMS = [
  'roof',
  'basement_water',
  'foundation',
  'heating',
  'cooling',
  'water_heater',
  'plumbing',
  'electrical',
  'water_sewer',
  'wood_insects',
  'radon',
  'lead_paint',
  'fuel_tanks',
  'mold',
  'pool_spa',
  'windows_doors',
  'appliances',
  'hoa',
  'liens_violations',
  'flooding',
] as const;
export const disclosureItemEnum = pgEnum('disclosure_item', DISCLOSURE_ITEMS);
export const disclosureAnswerEnum = pgEnum('disclosure_answer', ['yes', 'no', 'unknown', 'na']);

export const clientKindEnum = pgEnum('client_kind', ['person', 'couple', 'company', 'estate']);
export const clientRoleEnum = pgEnum('client_role', ['buyer', 'seller', 'landlord', 'tenant', 'business_owner']);

export const dealStageEnum = pgEnum('deal_stage', ['active', 'under_offer', 'under_contract', 'settlement', 'closed', 'fallen_through']);
export const dealSideEnum = pgEnum('deal_side', ['buyer', 'seller', 'tenant', 'landlord']);
export const showingStatusEnum = pgEnum('showing_status', ['requested', 'confirmed', 'completed', 'cancelled', 'no_show']);

export const FORM_TYPES = [
  'listing_contract',
  'disclosure_statement',
  'agreement_of_sale',
  'agreement_change',
  'business_listing',
  'earnest_money',
  'business_sale',
  'settlement_handover',
] as const;
export const formTypeEnum = pgEnum('form_type', FORM_TYPES);
export const documentStatusEnum = pgEnum('document_status', ['draft', 'sent', 'signed']);

export const enquiryTypeEnum = pgEnum('enquiry_type', [
  'showing_request',
  'valuation_request',
  'general_contact',
  'career_application',
  'listing_question',
]);
export const enquiryStatusEnum = pgEnum('enquiry_status', ['new', 'open', 'waiting', 'closed']);
export const postKindEnum = pgEnum('post_kind', ['guide', 'news']);
