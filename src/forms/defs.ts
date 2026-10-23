// The eight Pennsylvania forms, transcribed from reference/forms-pa.html: same sections, fields, options and
// standard terms. Brokerage names, contact lines and agent names come from settings and the deal at render time.
import { DISCLOSURE_ITEMS } from '@/db/schema/enums';
import type { FormType } from '@/lib/refs';
import type { FieldDef, FormDef, SectionDef, TableDef } from './types';

export const PROPERTY_TYPES = ['Single-family detached', 'Twin / semi-detached', 'Rowhome / townhouse', 'Condominium', 'Bungalow'] as const;
export const OCCUPANCY = ['Owner-occupied', 'Vacant', 'Tenant-occupied'] as const;
export const DEPOSIT_METHODS = ['Cashier’s check', 'Certified check', 'Wire transfer', 'Electronic funds transfer'] as const;
export const BUSINESS_TYPES = ['Restaurant / diner', 'Café / coffee shop', 'Convenience store & fuel', 'Retail shop', 'Auto repair garage', 'Car dealership', 'Bar / nightlife', 'Salon / barbershop', 'Gym / fitness', 'Office / professional', 'Other'] as const;
export const WHAT_IS_SOLD = ['Business and building (owner-owned)', 'Business only (leased premises)'] as const;
export const YES_NO = ['Yes', 'No'] as const;
export const DISCLOSURE_ANSWERS = ['Yes', 'No', 'Unknown', 'N/A'] as const;
const CONT_STATUS = ['Pending', 'Satisfied', 'Waived', 'Not met'] as const;
const BENEFIT = ['Buyer', 'Seller'] as const;

export const DISCLOSURE_LABELS: Record<(typeof DISCLOSURE_ITEMS)[number], string> = {
  roof: 'Roof',
  basement_water: 'Basement and water leakage',
  foundation: 'Foundation and structure',
  heating: 'Heating system',
  cooling: 'Air conditioning',
  water_heater: 'Water heater',
  plumbing: 'Plumbing',
  electrical: 'Electrical system',
  water_sewer: 'Water supply and sewer',
  wood_insects: 'Wood-destroying insects (termites)',
  radon: 'Radon',
  lead_paint: 'Lead-based paint (homes built before 1978)',
  fuel_tanks: 'Fuel or oil tanks',
  mold: 'Mold',
  pool_spa: 'Pool or spa',
  windows_doors: 'Windows, doors and garage doors',
  appliances: 'Included appliances',
  hoa: 'HOA or planned community',
  liens_violations: 'Liens, code violations or legal actions',
  flooding: 'Flooding or drainage',
};

// ---- Shared field groups ----

const f = (id: string, label: string, kind: FieldDef['kind'], span: FieldDef['span'], extra: Partial<FieldDef> = {}): FieldDef => ({ id, label, kind, span, ...extra });

const sellerFields = (who = 'Seller'): FieldDef[] => [
  f('seller_name', `${who}(s)`, 'text', 8, { placeholder: 'Full legal name(s)' }),
  f('seller_contact', `${who} Contact`, 'text', 4, { placeholder: 'In-game username' }),
  f('seller_addr', `${who} Mailing Address`, 'text', 8, { placeholder: `Where the ${who.toLowerCase()} can be reached` }),
];

/** Street, area (quick picker fills city and ZIP), state, county, ZIP. */
const addressFields = (withArea = true): FieldDef[] => [
  f('prop_address', 'Street Address', 'text', 6, { placeholder: 'Street address' }),
  ...(withArea ? [f('prop_area', 'Town / Area', 'area', 6)] : []),
  f('prop_city', 'City / Borough / Township', 'text', withArea ? 5 : 4, { placeholder: withArea ? 'Filled from Town / Area' : 'Municipality' }),
  ...(withArea ? [f('prop_state', 'State', 'text', 2, { initial: 'PA' }), f('prop_county', 'County', 'text', 3, { initial: 'Dauphin' })] : []),
  f('prop_zip', 'ZIP Code', 'text', 2, { mono: true, placeholder: '17101' }),
];

const contingencies = (id: string, rows: [string, string][]): TableDef => ({
  id,
  caption: 'Contingencies',
  columns: [
    { id: 'on', label: 'Incl.', kind: 'checkbox' },
    { id: 'who', label: 'For Benefit Of', kind: 'select', options: BENEFIT },
    { id: 'date', label: 'Deadline', kind: 'date' },
    { id: 'st', label: 'Status', kind: 'select', options: CONT_STATUS },
  ],
  rows: [...rows.map(([rid, label]) => ({ id: rid, label })), { id: 'other', label: 'Other contingency (write in)', writeIn: true }],
});

const consumerNotice = (who: string): FieldDef => f('consumer_notice', `${who} received the Consumer Notice at the first meeting with the agent`, 'checkbox', 12);

const notes = (label = 'Agent’s Notes', placeholder?: string): SectionDef => ({ title: label, fields: [f('notes', label, 'textarea', 12, { placeholder })] });

// ---- The forms ----

const listingContract: FormDef = {
  type: 'listing_contract',
  subtitle: 'Commonwealth of Pennsylvania · Residential',
  reference: 'Between the Seller and the Brokerage',
  dateLabel: 'Date Signed',
  kind: 'home',
  sections: [
    { title: 'Seller(s)', note: 'Everyone on the deed signs', fields: [...sellerFields(), f('seller_vesting', 'How Title Is Held', 'text', 4, { placeholder: 'e.g. Sole owner' }), consumerNotice('Seller')] },
    {
      title: 'Property',
      note: 'Dauphin County',
      fields: [
        ...addressFields(),
        f('parcel', 'Tax Parcel ID', 'text', 4, { mono: true, placeholder: 'e.g. 62-809-095' }),
        f('prop_type', 'Property Type', 'select', 4, { options: PROPERTY_TYPES }),
        f('prop_year', 'Year Built', 'number', 4, { placeholder: '1998' }),
        f('prop_beds', 'Bedrooms', 'number', 2, { placeholder: '3' }),
        f('prop_baths', 'Bathrooms', 'number', 2, { placeholder: '2' }),
        f('prop_park', 'Parking / Garage', 'text', 8, { placeholder: 'e.g. Two-car attached garage' }),
        f('prop_legal', 'Description of Property', 'text', 12, { placeholder: 'e.g. Two-storey detached dwelling with rear yard' }),
      ],
    },
    {
      title: 'Listing Price & Term',
      note: 'U.S. dollars',
      fields: [
        f('price', 'Listing Price', 'money', 4),
        f('price_words', 'Listing Price in Words', 'computed', 8, { compute: 'price_words' }),
        f('listing_start', 'Listing Starts', 'date', 4),
        f('listing_end', 'Listing Ends', 'date', 4),
        f('occupancy', 'Occupancy', 'select', 4, { options: OCCUPANCY }),
      ],
    },
    {
      title: 'Commission',
      note: 'Paid by the Seller at settlement',
      fields: [
        f('comm_total', 'Total Commission (%)', 'percent', 3, { initial: '5' }),
        f('comm_side', 'Listing Brokerage Share (%)', 'percent', 3, { initial: '2.5' }),
        f('comm_coop', 'Offered to Buyer’s Broker (%)', 'percent', 3, { initial: '2.5' }),
        f('comm_total_amt', 'Total at Listing Price', 'computed', 3, { compute: 'comm_total_amt' }),
      ],
      notice: ['Commission', 'Commission is earned only if the property is sold during the listing term, or within 90 days after it ends to a buyer introduced during the term. It is paid from the Seller’s proceeds at settlement. No commission is owed if the property does not sell.'],
    },
    {
      title: 'Property Facts',
      fields: [
        f('taxes', 'Annual Property Taxes', 'text', 4, { placeholder: 'e.g. About $6,200 per year' }),
        f('hoa', 'HOA / Community Fees', 'text', 4, { placeholder: 'e.g. None' }),
        f('mortgage', 'Existing Mortgage Lender', 'text', 4, { placeholder: 'e.g. None' }),
      ],
    },
    {
      title: 'Marketing & Showings',
      fields: [
        f('yard_sign', 'Yard Sign', 'radio', 4, { options: YES_NO }),
        f('photos_allowed', 'Photos & Online Listing', 'radio', 4, { options: YES_NO }),
        f('lockbox', 'Lockbox', 'radio', 4, { options: YES_NO }),
        f('show_notes', 'Showing Instructions', 'textarea', 12, { placeholder: 'e.g. 24 hours’ notice. Seller leaves during showings.' }),
      ],
    },
    {
      title: 'Terms',
      terms: [
        ['Exclusive right.', 'The Seller gives the Brokerage the exclusive right to sell the property during the listing term, whoever finds the buyer.'],
        ['Authority.', 'The Seller confirms they own the property, or have the legal authority to sell it, and that everyone whose signature is needed has signed.'],
        ['Disclosure.', 'The Seller will complete a Seller’s Property Disclosure Statement and tell the brokerage about any material defect they know of.'],
        ['Offers.', 'The brokerage will present every written offer to the Seller promptly. The Seller decides whether to accept, reject or counter.'],
        ['Deposits.', 'Earnest money received by the brokerage is held in its escrow account until settlement or termination.'],
        ['Showings and access.', 'The Seller will allow showings as set out in Section 6 and keep the property in show-ready condition.'],
        ['Ending early.', 'This contract may be ended before the listing term only by written agreement of both parties.'],
        ['Professional advice.', 'The Brokerage does not provide legal, tax or financial advice. The Seller is encouraged to consult qualified professionals.'],
      ],
    },
    { title: 'Signatures', signatures: [{ parties: ['seller', 'seller2', 'agent'] }] },
  ],
  signatures: [
    { party: 'seller', label: 'Seller' },
    { party: 'seller2', label: 'Second Seller (if any)', optional: true },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const disclosureStatement: FormDef = {
  type: 'disclosure_statement',
  subtitle: 'Completed by the Seller · Residential Property',
  reference: 'Given to buyers before they sign an Agreement of Sale',
  dateLabel: 'Date Completed',
  kind: 'home',
  sections: [
    {
      title: 'Seller & Property',
      notice: ['Notice to buyers', 'This statement describes the property as the Seller knows it. It is not a warranty and does not replace a professional home inspection. The Seller must tell the Buyer if anything changes before settlement.'],
      fields: [
        f('seller_name', 'Seller(s)', 'text', 8, { placeholder: 'Full legal name(s)' }),
        f('seller_capacity', 'Seller Is', 'select', 4, { options: ['The owner', 'Executor of an estate', 'Trustee'] }),
        f('prop_address', 'Property Address', 'text', 6, { placeholder: 'Street address' }),
        f('prop_city', 'City / Borough / Township', 'text', 4, { placeholder: 'Municipality' }),
        f('prop_zip', 'ZIP', 'text', 2, { mono: true, placeholder: '17101' }),
        f('prop_year', 'Year Built', 'number', 3, { placeholder: '1998' }),
        f('owned_since', 'Owned Since', 'text', 5, { placeholder: 'e.g. June 2000' }),
        f('occupancy', 'Occupancy', 'select', 4, { options: OCCUPANCY }),
      ],
    },
    {
      title: 'Condition of the Property',
      note: 'Known problem? Answer every line',
      table: {
        id: 'cond',
        caption: 'Condition of the property',
        columns: [
          { id: 'a', label: 'Known problem?', kind: 'select', options: DISCLOSURE_ANSWERS },
          { id: 'd', label: 'Details', kind: 'textarea', placeholder: 'Age, type, repairs' },
        ],
        rows: DISCLOSURE_ITEMS.map((item) => ({ id: item, label: DISCLOSURE_LABELS[item] })),
      },
    },
    { title: 'Anything Else the Buyer Should Know', fields: [f('other_disclosures', 'Other disclosures', 'textarea', 12, { placeholder: 'e.g. Repairs, insurance claims, neighbourhood issues' })] },
    {
      title: 'Signatures',
      signatures: [
        { statement: ['Seller.', 'The information above is true and complete to the best of my knowledge on the date signed.'], parties: ['seller', 'seller2'] },
        { statement: ['Buyer.', 'I received this statement before signing an Agreement of Sale. I understand it is not a warranty or a substitute for an inspection.'], parties: ['buyer', 'agent'] },
      ],
    },
  ],
  signatures: [
    { party: 'seller', label: 'Seller' },
    { party: 'seller2', label: 'Second Seller (if any)', optional: true },
    { party: 'buyer', label: 'Buyer', optional: true },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const agreementOfSale: FormDef = {
  type: 'agreement_of_sale',
  subtitle: 'Commonwealth of Pennsylvania · Residential Resale',
  reference: 'Prepared by the Brokerage',
  dateLabel: 'Date of Agreement',
  kind: 'home',
  sections: [
    {
      title: 'Parties',
      note: 'Full legal names as they will appear on the deed',
      fields: [
        f('buyer_name', 'Buyer(s)', 'text', 8, { placeholder: 'Full legal name(s)' }),
        f('buyer_contact', 'Buyer Contact', 'text', 4, { placeholder: 'In-game username' }),
        f('buyer_addr', 'Buyer Mailing Address', 'text', 8, { placeholder: 'Street, City, State, ZIP' }),
        f('buyer_type', 'Buyer Type', 'select', 4, { options: ['Individual', 'Joint purchasers', 'LLC / company'] }),
        f('seller_name', 'Seller(s)', 'text', 8, { placeholder: 'Full legal name(s)' }),
        f('seller_contact', 'Seller Contact', 'text', 4, { placeholder: 'In-game username' }),
        f('seller_addr', 'Seller Mailing Address', 'text', 12, { placeholder: 'Where the seller can be reached after settlement' }),
      ],
    },
    {
      title: 'Property',
      note: 'Dauphin County',
      fields: [
        ...addressFields(),
        f('parcel', 'Tax Parcel ID', 'text', 4, { mono: true, placeholder: 'e.g. 63-018-061' }),
        f('prop_type', 'Property Type', 'select', 4, { options: PROPERTY_TYPES }),
        f('prop_park', 'Parking / Garage', 'text', 4, { placeholder: 'e.g. Two-car attached garage' }),
        f('prop_beds', 'Bedrooms', 'number', 2, { placeholder: '3' }),
        f('prop_baths', 'Bathrooms', 'number', 2, { placeholder: '2' }),
        f('prop_year', 'Year Built', 'number', 2, { placeholder: '1998' }),
        f('prop_zoning', 'Zoning Classification', 'text', 6, { placeholder: 'e.g. R-1 Residential' }),
        f('prop_legal', 'Description of Property', 'text', 12, { placeholder: 'e.g. Two-storey detached dwelling with rear yard' }),
      ],
    },
    {
      title: 'Purchase Price, Deposit & Financing',
      note: 'U.S. dollars',
      fields: [
        f('price', 'Purchase Price', 'money', 4),
        f('price_words', 'Purchase Price in Words', 'computed', 8, { compute: 'price_words' }),
        f('deposit', 'Earnest Money Deposit', 'money', 4),
        f('deposit_method', 'Deposit Method', 'select', 4, { options: DEPOSIT_METHODS }),
        f('deposit_due', 'Deposit Due', 'select', 4, { options: ['Within 5 days of acceptance', 'Within 24 hours of acceptance', 'With this offer'] }),
        f('deposit_words', 'Deposit in Words', 'computed', 8, { compute: 'deposit_words' }),
        f('balance', 'Balance Due at Settlement', 'computed', 4, { compute: 'balance' }),
        f('financing', 'Financing', 'select', 4, { options: ['Conventional mortgage', 'FHA mortgage', 'VA mortgage', 'USDA mortgage', 'Cash (no financing)'] }),
        f('loan', 'Mortgage Amount', 'money', 4),
        f('lender', 'Lender', 'text', 4, { placeholder: 'Bank or mortgage company' }),
      ],
      notice: ['Deposit', 'The earnest money deposit is held in escrow by the Brokerage, without interest, until settlement or termination of this Agreement. It is credited toward the Purchase Price at settlement. The balance, subject to prorations and adjustments, is payable at settlement.'],
    },
    {
      title: 'Contingencies',
      note: 'Tick each contingency that applies to this offer',
      table: contingencies('cont', [
        ['mortgage', 'Buyer obtaining a written mortgage commitment'],
        ['inspection', 'Home inspection satisfactory to the Buyer'],
        ['appraisal', 'Property appraising at or above the Purchase Price'],
        ['termite', 'Wood-destroying insect (termite) inspection'],
        ['radon', 'Radon testing'],
        ['sale', 'Sale and settlement of the Buyer’s existing property'],
      ]),
    },
    {
      title: 'Disclosures & Costs',
      fields: [
        f('spds_received', 'Seller’s Property Disclosure Statement received by Buyer', 'radio', 6, { options: YES_NO }),
        f('lead_disclosure', 'Lead-Based Paint Disclosure (homes built before 1978)', 'radio', 6, { options: ['Provided', 'Not applicable'] }),
        f('transfer_tax', 'Realty Transfer Tax', 'select', 6, { options: ['Split equally between Buyer and Seller', 'Paid by Buyer', 'Paid by Seller'] }),
        f('home_warranty', 'Home Warranty Included', 'radio', 6, { options: YES_NO }),
      ],
    },
    {
      title: 'Personal Property, Fixtures & Leased Items',
      fields: [
        f('included', 'Personal Property Included', 'textarea', 6, { placeholder: 'e.g. Refrigerator, range, dishwasher, washer, dryer, all window treatments' }),
        f('excluded', 'Fixtures Excluded', 'textarea', 6, { placeholder: 'e.g. Dining room chandelier, wall-mounted television' }),
        f('leased_items', 'Leased Items Assumed by Buyer', 'text', 12, { placeholder: 'e.g. Water heater (leased), solar panels, or None' }),
      ],
    },
    {
      title: 'Offer Expiration, Settlement & Possession',
      fields: [
        f('offer_expires', 'Offer Expires', 'datetime', 6),
        f('settle_date', 'Settlement Date', 'date', 6),
        f('possession', 'Possession', 'select', 6, { options: ['At settlement, by delivery of deed and keys', 'Subject to existing lease'] }),
        f('walk_through', 'Pre-Settlement Walk-Through', 'radio', 6, { options: ['Permitted', 'Waived by Buyer'] }),
      ],
    },
    {
      title: 'Brokers & Commission',
      fields: [
        f('listing_broker', 'Listing Broker', 'text', 6, { placeholder: 'Brokerage name' }),
        f('agent_name', 'Listing Agent', 'text', 6, { placeholder: 'Agent name' }),
        f('buyer_broker', 'Buyer’s Broker', 'text', 6, { placeholder: 'Brokerage name' }),
        f('buyer_agent', 'Buyer’s Agent', 'text', 6, { placeholder: 'Agent name' }),
        f('represents', 'The Brokerage Represents', 'select', 6, { options: ['The Buyer', 'The Seller', 'Both parties (dual agency, with written consent)', 'Neither party (transaction licensee)'] }),
        f('comm_total', 'Total Commission (%)', 'percent', 3, { initial: '5' }),
        f('comm_by', 'Payable By', 'select', 3, { options: ['Seller', 'Buyer', 'Split as agreed'] }),
      ],
    },
    {
      title: 'Settlement & Title',
      fields: [
        f('settle_co', 'Title / Settlement Company', 'text', 12, { placeholder: 'e.g. Keystone Abstract & Title Co.' }),
        f('buyer_lawyer', 'Buyer’s Attorney (optional)', 'text', 6, { placeholder: 'Name, firm' }),
        f('seller_lawyer', 'Seller’s Attorney (optional)', 'text', 6, { placeholder: 'Name, firm' }),
      ],
    },
    {
      title: 'Standard Terms',
      terms: [
        ['Deposit.', 'The Buyer shall pay the earnest money deposit as set out in Section 3. If it is not paid when due, the Seller may terminate this Agreement in writing.'],
        ['Contingencies.', 'Each contingency is for the benefit of the party named and may be waived in writing by that party before its deadline. If a contingency is not satisfied or waived by its deadline, either party may terminate this Agreement in writing, and the deposit is returned to the Buyer.'],
        ['Title.', 'The Seller shall convey good and marketable title by deed, free of liens and encumbrances except those agreed to in writing. The Buyer may obtain title insurance at the Buyer’s expense.'],
        ['Prorations.', 'Real estate taxes, municipal charges, utilities and similar items are prorated to the settlement date.'],
        ['Condition of property.', 'The Seller shall keep the property in its present condition until settlement, normal wear and tear excepted, including all included personal property.'],
        ['Risk of loss.', 'The Seller bears the risk of loss from fire or other casualty until settlement and shall keep the property insured until then.'],
        ['Time.', 'Time is of the essence. Dates in this Agreement may be changed only in writing, signed by both Buyer and Seller.'],
        ['Entire agreement.', 'This Agreement, with any attached addenda, is the entire agreement between the parties. Electronic signatures and copies are binding.'],
        ['Professional advice.', 'The Brokerage does not provide legal, tax, financing, title or inspection advice. The parties are encouraged to consult qualified professionals before signing.'],
      ],
    },
    {
      title: 'Signatures',
      note: 'Offer and acceptance',
      signatures: [
        { parties: ['buyer', 'witness'] },
        { statement: ['Acceptance.', 'The Seller accepts the above offer and agrees to pay commission to the broker(s) named in Section 8, as stated.'], parties: ['seller', 'agent'] },
      ],
      after: [f('accepted_at', 'Date & Time of Acceptance', 'datetime', 6)],
    },
    notes('Agent’s Notes', 'e.g. Buyer viewed the property on 14 October. Offer presented to the Seller the same day.'),
  ],
  signatures: [
    { party: 'buyer', label: 'Signature of Buyer' },
    { party: 'witness', label: 'Witness', optional: true },
    { party: 'seller', label: 'Signature of Seller' },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const agreementChange: FormDef = {
  type: 'agreement_change',
  subtitle: 'Addendum · Counteroffer · Amendment',
  reference: 'Changes the Agreement of Sale named below',
  dateLabel: 'Date',
  kind: 'any',
  footerAgreement: true,
  sections: [
    {
      title: 'Agreement Being Changed',
      fields: [
        f('agreement_no', 'Agreement of Sale No.', 'text', 4, { mono: true, placeholder: 'AOS-2026-0000' }),
        f('prop_address', 'Property Address', 'text', 8, { placeholder: 'Street address' }),
        f('buyer_name', 'Buyer(s)', 'text', 6, { placeholder: 'Full legal name' }),
        f('seller_name', 'Seller(s)', 'text', 6, { placeholder: 'Full legal name' }),
        f('change_type', 'Type of Change', 'select', 6, { options: ['Counteroffer', 'Price change', 'Repair credit', 'Repairs by the Seller', 'Settlement date change', 'Contingency deadline extension', 'Other'] }),
        f('proposed_by', 'Proposed By', 'select', 6, { options: ['Seller', 'Buyer'] }),
      ],
    },
    {
      title: 'Changes',
      note: 'Fill in only the lines that change',
      table: {
        id: 'chg',
        caption: 'Changes',
        columns: [
          { id: 'now', label: 'Currently', kind: 'text', placeholder: 'Currently' },
          { id: 'to', label: 'Change To', kind: 'text', placeholder: 'Change to' },
        ],
        rows: [
          { id: 'price', label: 'Purchase Price', kind: 'money' },
          { id: 'deposit', label: 'Earnest Money', kind: 'money' },
          { id: 'settle', label: 'Settlement Date', kind: 'date' },
          { id: 'credit', label: 'Seller Credit at Settlement', kind: 'money' },
          { id: 'cont', label: 'Contingency deadline (e.g. Inspection)', writeIn: true, kind: 'date' },
          { id: 'other', label: 'Other term (write in)', writeIn: true },
        ],
      },
      after: [f('details', 'Details', 'textarea', 12, { placeholder: 'e.g. Seller will credit the Buyer $3,000 at settlement for the water heater found in the inspection.' })],
    },
    {
      title: 'Response',
      fields: [f('respond_by', 'Respond By', 'datetime', 6)],
      notice: ['Notice', 'Every other term of the Agreement of Sale stays the same. This change takes effect only when signed by both Buyer and Seller. If it is not accepted by the time above, it expires.'],
    },
    { title: 'Signatures', signatures: [{ parties: ['buyer', 'seller', 'agent'] }] },
  ],
  signatures: [
    { party: 'buyer', label: 'Buyer' },
    { party: 'seller', label: 'Seller' },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const businessListing: FormDef = {
  type: 'business_listing',
  subtitle: 'Exclusive Right to Sell · Business and Commercial Property',
  reference: 'Between the business owner and the Brokerage',
  dateLabel: 'Date Signed',
  kind: 'business',
  sections: [
    {
      title: 'Owner',
      note: 'The person or company selling',
      fields: [
        f('seller_name', 'Owner(s)', 'text', 8, { placeholder: 'Full legal name(s)' }),
        f('seller_contact', 'Owner Contact', 'text', 4, { placeholder: 'In-game username' }),
        f('biz_entity', 'Legal Business Entity', 'text', 8, { placeholder: 'e.g. Example Diner LLC' }),
        f('biz_signer', 'Signing As', 'text', 4, { placeholder: 'e.g. Sole member' }),
        f('seller_addr', 'Owner Mailing Address', 'text', 12, { placeholder: 'Where the owner can be reached' }),
        consumerNotice('Owner'),
      ],
    },
    {
      title: 'Business',
      note: 'Dauphin County',
      fields: [
        f('biz_name', 'Business Name', 'text', 6, { placeholder: 'Trading name' }),
        f('biz_type', 'Type of Business', 'select', 6, { options: BUSINESS_TYPES }),
        ...addressFields(),
        f('biz_years', 'Years Operating', 'number', 3, { placeholder: '12' }),
        f('biz_emp', 'Employees', 'number', 3, { placeholder: '6' }),
        f('biz_hours', 'Opening Hours', 'text', 6, { placeholder: 'e.g. Daily, 6 am to 3 pm' }),
      ],
    },
    {
      title: 'Premises',
      fields: [
        f('biz_re', 'What Is Being Sold', 'select', 6, { options: WHAT_IS_SOLD }),
        f('biz_sqft', 'Building Size', 'text', 3, { placeholder: 'e.g. 2,400 sq ft' }),
        f('parcel', 'Tax Parcel ID', 'text', 3, { mono: true, placeholder: 'If owned' }),
        f('biz_rent', 'Monthly Rent (if leased)', 'text', 4, { placeholder: 'e.g. $3,200' }),
        f('biz_lease_end', 'Lease Ends', 'text', 4, { placeholder: 'e.g. Dec 2029' }),
        f('biz_landlord', 'Landlord', 'text', 4, { placeholder: 'If leased' }),
      ],
    },
    {
      title: 'Price & Financials',
      note: 'Figures supplied by the owner',
      fields: [
        f('price', 'Asking Price', 'money', 4),
        f('price_words', 'Asking Price in Words', 'computed', 8, { compute: 'price_words' }),
        f('biz_sales', 'Yearly Sales', 'money', 4),
        f('biz_profit', 'Yearly Owner Profit', 'money', 4),
        f('biz_multiple', 'Price to Profit', 'computed', 4, { compute: 'biz_multiple' }),
        f('biz_inv', 'Inventory Value (at cost)', 'money', 4),
        f('biz_sf', 'Owner Will Finance Part of the Price', 'select', 8, { options: ['No', 'Yes, up to 15% of the price', 'Yes, up to 20% of the price', 'Yes, up to 25% of the price'] }),
      ],
    },
    {
      title: 'What the Sale Includes',
      fields: [
        f('biz_included', 'Included', 'textarea', 6, { placeholder: 'e.g. All equipment, furniture, business name, recipes, phone number, website and social pages' }),
        f('biz_excluded', 'Excluded', 'textarea', 6, { placeholder: 'e.g. Owner’s personal items, cash on hand, bank accounts' }),
        f('biz_licenses', 'Licenses & Permits', 'textarea', 12, { placeholder: 'e.g. Health permit (buyer must get a new one), liquor licence transfer' }),
      ],
    },
    {
      title: 'Commission',
      fields: [
        f('comm_total', 'Commission (%)', 'percent', 3, { initial: '10' }),
        f('comm_side', 'Brokerage Share (%)', 'percent', 3, { initial: '10' }),
        f('comm_total_amt', 'Commission at Asking Price', 'computed', 6, { compute: 'comm_total_amt' }),
      ],
      notice: ['Commission', 'Business sales usually carry a higher commission than home sales, because they take more work to market and close. It is paid from the owner’s proceeds at settlement, and shared with the buyer’s broker if there is one. No commission is owed if the business does not sell.'],
    },
    {
      title: 'Confidentiality & Showings',
      fields: [
        f('biz_conf', 'Keep the sale confidential: staff and customers are not told, and buyers sign a confidentiality agreement before seeing the financial records', 'checkbox', 12),
        f('show_notes', 'Showing Instructions', 'textarea', 12, { placeholder: 'e.g. After closing time only. Do not discuss the sale with staff.' }),
      ],
    },
    {
      title: 'Terms',
      terms: [
        ['Exclusive right.', 'The owner gives the Brokerage the exclusive right to sell the business during the listing term, whoever finds the buyer.'],
        ['Authority.', 'The owner confirms they own the business and its assets, or are authorised to sell them for the company named above.'],
        ['Financial information.', 'The owner supplies the sales and profit figures. The Brokerage passes them on but does not audit or guarantee them.'],
        ['Confidentiality.', 'If ticked in Section 7, the brokerage will share the business’s name and financial records only with buyers who have signed a confidentiality agreement.'],
        ['Licenses.', 'Some licenses and permits cannot be transferred, and a buyer may need to apply for new ones. The owner will help the buyer through that process.'],
        ['Running the business.', 'The owner will keep running the business normally until settlement.'],
        ['Ending early.', 'This contract may be ended before the listing term only by written agreement of both parties.'],
        ['Professional advice.', 'The Brokerage does not provide legal, tax or accounting advice. The owner is encouraged to consult an attorney and an accountant.'],
      ],
    },
    { title: 'Signatures', signatures: [{ parties: ['seller', 'seller2', 'agent'] }] },
  ],
  signatures: [
    { party: 'seller', label: 'Owner' },
    { party: 'seller2', label: 'Second Owner (if any)', optional: true },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const earnestMoney: FormDef = {
  type: 'earnest_money',
  subtitle: 'Funds Received in Escrow',
  reference: 'Issued under Residential Agreement of Sale',
  dateLabel: 'Date & Time Received',
  dateKind: 'datetime',
  kind: 'any',
  unnumbered: true,
  footerAgreement: true,
  sections: [
    {
      title: 'Received From',
      fields: [f('buyer_name', 'Payer (Buyer)', 'text', 8, { placeholder: 'Full legal name' }), f('buyer_contact', 'Payer Contact', 'text', 4, { placeholder: 'In-game username' })],
    },
    {
      title: 'Regarding',
      fields: [
        f('agreement_no', 'Agreement of Sale No.', 'text', 4, { mono: true, placeholder: 'AOS-2026-0000' }),
        f('prop_address', 'Property Address', 'text', 5, { placeholder: 'Street address' }),
        f('prop_city', 'City / Borough / Township', 'text', 3, { placeholder: 'Municipality' }),
        f('seller_name', 'Seller(s)', 'text', 8, { placeholder: 'Full legal name' }),
        f('price', 'Purchase Price', 'money', 4),
      ],
    },
    {
      title: 'Amount Received',
      note: 'U.S. dollars',
      fields: [
        f('deposit', 'Amount', 'money', 4),
        f('deposit_words', 'Amount in Words', 'computed', 8, { compute: 'deposit_words' }),
        f('deposit_method', 'Method of Payment', 'select', 4, { options: DEPOSIT_METHODS }),
        f('check_ref', 'Check / Reference No.', 'text', 4, { mono: true, placeholder: 'e.g. 004418' }),
        f('bank', 'Drawn On (Bank)', 'text', 4, { placeholder: 'Bank name' }),
      ],
    },
    {
      title: 'Held In Escrow',
      fields: [f('escrow_account', 'Escrow Account', 'text', 8, { placeholder: 'Brokerage escrow account' }), f('escrow_ref', 'Escrow Ledger Ref.', 'text', 4, { mono: true, placeholder: 'ESC-0000' })],
      notice: ['Notice', 'These funds are held in escrow by the Brokerage under the Agreement of Sale referenced above and will be credited toward the Purchase Price at settlement. If the Agreement is terminated, the funds are released only as the Agreement provides, with the written agreement of both Buyer and Seller, or by court order.'],
    },
    { title: 'Signatures', signatures: [{ parties: ['agent', 'payer'] }] },
    notes('Agent’s Notes', 'e.g. Cashier’s check received in person at the office.'),
  ],
  signatures: [
    { party: 'agent', label: 'Received By', agent: true },
    { party: 'payer', label: 'Acknowledged By Payer' },
  ],
};

const businessSale: FormDef = {
  type: 'business_sale',
  subtitle: 'Sale of Business Assets · Commonwealth of Pennsylvania',
  reference: 'Prepared by the Brokerage',
  dateLabel: 'Date of Agreement',
  kind: 'business',
  sections: [
    {
      title: 'Parties',
      fields: [
        f('buyer_name', 'Buyer(s)', 'text', 8, { placeholder: 'Full legal name' }),
        f('buyer_contact', 'Buyer Contact', 'text', 4, { placeholder: 'In-game username' }),
        f('buyer_as', 'Buyer Is Buying As', 'select', 6, { options: ['An individual', 'A new company (LLC) being formed', 'An existing company'] }),
        f('buyer_entity', 'Buyer’s Company Name (if any)', 'text', 6, { placeholder: 'e.g. Example Hospitality LLC' }),
        f('seller_name', 'Seller(s)', 'text', 8, { placeholder: 'Full legal name(s)' }),
        f('seller_contact', 'Seller Contact', 'text', 4, { placeholder: 'In-game username' }),
        f('biz_entity', 'Selling Company', 'text', 12, { placeholder: 'e.g. Example Diner LLC' }),
      ],
    },
    {
      title: 'Business Being Sold',
      fields: [
        f('biz_name', 'Business Name', 'text', 6, { placeholder: 'Trading name' }),
        f('biz_type', 'Type of Business', 'select', 6, { options: BUSINESS_TYPES }),
        ...addressFields(false),
        f('biz_re', 'What Is Being Sold', 'select', 6, { options: WHAT_IS_SOLD }),
        f('biz_landlord', 'Landlord (if leased)', 'text', 6, { placeholder: 'Landlord name' }),
      ],
    },
    {
      title: 'Price, Deposit & Payment',
      note: 'U.S. dollars',
      fields: [f('price', 'Purchase Price', 'money', 4), f('price_words', 'Purchase Price in Words', 'computed', 8, { compute: 'price_words' })],
      table: {
        id: 'alloc',
        caption: 'How the price is split',
        columns: [{ id: 'amt', label: 'Amount', kind: 'money' }],
        rows: [
          { id: 'building', label: 'Building and land (if included)' },
          { id: 'equipment', label: 'Equipment, furniture and fixtures' },
          { id: 'inventory', label: 'Inventory (counted the day before settlement)' },
          { id: 'goodwill', label: 'Goodwill, business name and customer base' },
        ],
      },
      after: [
        f('alloc_total', 'Total of the split', 'computed', 12, { compute: 'alloc_total' }),
        f('deposit', 'Earnest Money Deposit', 'money', 4),
        f('deposit_method', 'Deposit Method', 'select', 4, { options: DEPOSIT_METHODS }),
        f('financing', 'Buyer Financing', 'select', 4, { options: ['Bank loan', 'SBA loan', 'Cash (no financing)'] }),
        f('sf_amount', 'Seller-Financed Amount', 'money', 4),
        f('sf_term', 'Seller Note Term', 'text', 4, { placeholder: 'e.g. 5 years, monthly payments' }),
        f('sf_rate', 'Seller Note Interest', 'text', 4, { placeholder: 'e.g. 7% per year' }),
        f('biz_balance', 'Balance Due at Settlement', 'computed', 12, { compute: 'biz_balance' }),
      ],
      notice: ['Payment', 'The deposit is held in escrow by the Brokerage. At settlement the Buyer pays the price, less the deposit and any amount the Seller is financing. A seller-financed amount is repaid under a separate promissory note signed at settlement.'],
    },
    {
      title: 'Included & Excluded',
      fields: [
        f('biz_included', 'Included', 'textarea', 6, { placeholder: 'Equipment, name, phone number, website, recipes' }),
        f('biz_excluded', 'Excluded', 'textarea', 6, { placeholder: 'Cash, bank accounts, personal items' }),
        f('biz_licenses', 'Licenses & Permits', 'textarea', 12, { placeholder: 'Which transfer, and which the Buyer must apply for' }),
      ],
    },
    {
      title: 'Contingencies',
      note: 'Tick each contingency that applies',
      table: contingencies('cont', [
        ['records', 'Buyer’s review of the financial records and tax returns'],
        ['financing', 'Buyer obtaining financing'],
        ['lease', 'Landlord approving the transfer of the lease'],
        ['licenses', 'Buyer obtaining the licenses and permits needed to operate'],
        ['inspection', 'Inspection of the building and equipment'],
        ['environmental', 'Environmental review of the site'],
      ]),
    },
    {
      title: 'Handover',
      fields: [
        f('biz_training', 'Seller Training Period', 'text', 4, { placeholder: 'e.g. 30 days, 20 hours a week' }),
        f('nc_distance', 'Non-Compete Distance', 'text', 4, { placeholder: 'e.g. 10 miles' }),
        f('nc_length', 'Non-Compete Length', 'text', 4, { placeholder: 'e.g. 5 years' }),
        f('biz_staff', 'Employees', 'select', 6, { options: ['Buyer may offer jobs to current staff', 'Buyer will keep all current staff', 'Seller ends all employment at settlement'] }),
        f('gift_cards', 'Gift Cards & Customer Deposits', 'text', 6, { placeholder: 'e.g. Seller credits the Buyer for unused gift cards' }),
      ],
      notice: ['Non-compete', 'The Seller agrees not to open or work for a competing business within the distance and time above, so the goodwill the Buyer pays for stays with the business.'],
    },
    {
      title: 'Settlement',
      fields: [
        f('settle_date', 'Settlement Date', 'date', 4),
        f('settle_co', 'Settlement Agent / Title Company', 'text', 8, { placeholder: 'Company name' }),
        f('buyer_lawyer', 'Buyer’s Attorney', 'text', 6, { placeholder: 'Name, firm' }),
        f('seller_lawyer', 'Seller’s Attorney', 'text', 6, { placeholder: 'Name, firm' }),
      ],
    },
    {
      title: 'Standard Terms',
      terms: [
        ['Asset sale.', 'The Buyer buys the assets listed above, not the Seller’s company. Debts and obligations from before settlement stay with the Seller unless this Agreement says otherwise.'],
        ['Financial statements.', 'The Seller confirms that the sales and profit figures given to the Buyer are accurate to the best of their knowledge.'],
        ['Running the business.', 'Until settlement, the Seller will run the business normally, keep stock at usual levels and not sell major equipment.'],
        ['Tax clearance.', 'The Seller will obtain a bulk sale clearance certificate from the Pennsylvania Department of Revenue before settlement, so the Buyer does not take on the Seller’s unpaid state taxes.'],
        ['Prorations.', 'Rent, utilities, property taxes and similar charges are split to the settlement date. Inventory is counted together the day before settlement and the price adjusted to the count.'],
        ['Risk of loss.', 'The Seller bears the risk of loss or damage until settlement and will keep the business insured until then.'],
        ['Time.', 'Time is of the essence. Dates may be changed only in writing signed by both parties.'],
        ['Entire agreement.', 'This Agreement, with any attached schedules, is the entire agreement between the parties. Electronic signatures and copies are binding.'],
        ['Professional advice.', 'The Brokerage does not provide legal, tax or accounting advice. Both parties are encouraged to consult an attorney and an accountant before signing.'],
      ],
    },
    { title: 'Signatures', signatures: [{ parties: ['buyer', 'seller', 'agent'] }] },
  ],
  signatures: [
    { party: 'buyer', label: 'Buyer' },
    { party: 'seller', label: 'Seller' },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

const settlementHandover: FormDef = {
  type: 'settlement_handover',
  subtitle: 'Confirmation of Settlement',
  reference: 'Walk-through, keys and brokerage record',
  dateLabel: 'Settlement Date',
  kind: 'any',
  unnumbered: true,
  footerAgreement: true,
  sections: [
    {
      title: 'Transaction',
      fields: [
        f('agreement_no', 'Agreement of Sale No.', 'text', 4, { mono: true, placeholder: 'AOS-2026-0000' }),
        f('prop_address', 'Property Address', 'text', 5, { placeholder: 'Street address' }),
        f('prop_zip', 'ZIP Code', 'text', 3, { mono: true, placeholder: '17110' }),
        f('buyer_name', 'Buyer(s)', 'text', 6, { placeholder: 'Full legal name' }),
        f('seller_name', 'Seller(s)', 'text', 6, { placeholder: 'Full legal name' }),
        f('price', 'Final Purchase Price', 'money', 4),
        f('settle_co', 'Title / Settlement Company', 'text', 8, { placeholder: 'Company name' }),
      ],
    },
    {
      title: 'Pre-Settlement Walk-Through',
      fields: [
        f('walk_done', 'Walk-Through Completed', 'radio', 4, { options: YES_NO }),
        f('walk_date', 'Walk-Through Date', 'date', 4),
        f('walk_condition', 'Condition as Agreed', 'radio', 4, { options: YES_NO }),
        f('walk_notes', 'Walk-Through Observations', 'textarea', 12, { placeholder: 'e.g. All included appliances present. No new damage observed.' }),
      ],
    },
    {
      title: 'Keys & Access',
      note: 'Tick each item as it is handed over',
      table: {
        id: 'keys',
        caption: 'Keys and access',
        columns: [
          { id: 'on', label: 'Given', kind: 'checkbox' },
          { id: 'q', label: 'Qty', kind: 'text', placeholder: '—' },
          { id: 'n', label: 'Notes', kind: 'text', placeholder: 'Notes' },
        ],
        rows: [
          { id: 'front', label: 'Front door keys' },
          { id: 'rear', label: 'Rear / side door keys' },
          { id: 'garage', label: 'Garage door remote(s)' },
          { id: 'gate', label: 'Community gate fob / access card' },
          { id: 'mailbox', label: 'Mailbox key' },
          { id: 'alarm', label: 'Alarm system code (provided in person, not written here)' },
          { id: 'other', label: 'Other item (write in)', writeIn: true },
        ],
      },
    },
    {
      title: 'Utilities & Services',
      note: 'Transferred to the Buyer from the settlement date',
      fields: [
        f('u_electric', 'Electric', 'checkbox', 4),
        f('u_gas', 'Gas', 'checkbox', 4),
        f('u_water', 'Water and sewer', 'checkbox', 4),
        f('u_trash', 'Trash collection', 'checkbox', 4),
        f('u_internet', 'Internet', 'checkbox', 4),
        f('u_insurance', 'Homeowner’s insurance in effect', 'checkbox', 4),
      ],
    },
    {
      title: 'Brokerage Record',
      note: 'Internal: commission on this transaction',
      internal: true,
      fields: [
        f('price_fmt', 'Sale Price', 'computed', 3, { compute: 'price_fmt' }),
        f('comm_total', 'Total Commission (%)', 'percent', 3, { initial: '5' }),
        f('comm_total_amt', 'Total Commission', 'computed', 6, { compute: 'comm_total_amt' }),
        f('comm_side', 'Brokerage Share (%)', 'percent', 3, { initial: '2.5' }),
        f('representing', 'Representing', 'select', 3, { options: ['Buyer', 'Seller', 'Both'] }),
        f('comm_side_amt', 'Commission Earned', 'computed', 6, { compute: 'comm_side_amt' }),
      ],
    },
    {
      title: 'Signatures',
      notice: ['Notice', 'Ownership passes when the signed deed is delivered at settlement. The title company then records the deed with the county Recorder of Deeds. Keys are released once the settlement agent confirms that settlement is complete. The Brokerage coordinates the handover but does not handle title, recording, mortgage funds or legal documents.'],
      signatures: [{ parties: ['buyer', 'agent'] }],
    },
    notes('Agent’s Notes', 'e.g. Keys handed over at the property after the title company confirmed settlement.'),
  ],
  signatures: [
    { party: 'buyer', label: 'Keys Received By · Buyer' },
    { party: 'agent', label: 'Real Estate Agent', agent: true },
  ],
};

export const FORM_DEFS: Record<FormType, FormDef> = {
  listing_contract: listingContract,
  disclosure_statement: disclosureStatement,
  agreement_of_sale: agreementOfSale,
  agreement_change: agreementChange,
  business_listing: businessListing,
  earnest_money: earnestMoney,
  business_sale: businessSale,
  settlement_handover: settlementHandover,
};

/** Form order for pickers, as on the old generator. */
export const FORM_ORDER: FormType[] = ['listing_contract', 'disclosure_statement', 'agreement_of_sale', 'agreement_change', 'earnest_money', 'settlement_handover', 'business_listing', 'business_sale'];
