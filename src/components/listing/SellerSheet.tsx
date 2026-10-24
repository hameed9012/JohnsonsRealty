import Link from 'next/link';
import { ConfidentialPanel } from '@/components/ui/documents';
import { DataSheet } from '@/components/ui/layout';
import { date, money } from '@/lib/format';
import { DISCLOSURE_LABELS } from '@/lib/schemas/listing';
import type { ListingBundle } from '@/server/listings/bundle';

const ANSWER = { yes: 'Yes', no: 'No', unknown: 'Unknown', na: 'N/A' } as const;
const yn = (v: boolean | null | undefined) => (v === true ? 'Yes' : v === false ? 'No' : '');

type Conf = { bottomLine: number | null; negotiationRules: string | null; relayLines: string | null; commissionTerms: string | null; yearlySales: number | null; yearlyProfit: number | null; inventoryValue: number | null } | null;
type ClientConf = { motivation: string | null; negotiationNotes: string | null; relayLines: string | null; commissionTerms: string | null } | null;

/**
 * The seller data sheet (reference/seller-files.md), built from the database. `confidential` is null when the
 * viewer may not see it; the panels then render redaction bars and no values exist on the page.
 */
export type SheetStep = 'property' | 'terms' | 'seller';

export function SellerSheet({
  b,
  confidential,
  clientConfidential,
  editHref,
}: {
  b: ListingBundle;
  confidential: Conf | undefined;
  clientConfidential: ClientConf | undefined;
  /** Where each section is edited, when the viewer may edit it. Links never print. */
  editHref?: (step: SheetStep) => string;
}) {
  const s = b.seller;
  const redacted = confidential === undefined;
  const head = (title: string, step: SheetStep) => (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <h3 className="heading-2">{title}</h3>
      {editHref ? (
        <Link className="no-print body-s" href={editHref(step)}>
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </Link>
      ) : null}
    </div>
  );
  return (
    <div className="stack-lg">
      <section className="stack">
        {head(b.purpose === 'rent' ? 'Landlord' : b.type === 'business' ? 'Owner' : 'Sellers', 'seller')}
        {s ? (
          <>
            <DataSheet
              rows={[
                { label: 'Client', value: s.displayName },
                { label: 'Name on forms', value: s.legalNameOnForms },
                { label: 'Best way to reach them', value: s.bestContact },
                { label: 'How they found us', value: s.source },
                { label: 'Living in the property now?', value: s.currentlyOccupying },
                { label: 'Mailing address after the move', value: s.mailingAddressAfter },
                { label: 'Reason', value: s.reason },
                { label: 'Timeline', value: s.timeline },
                { label: 'Who helps them decide', value: s.whoDecides },
              ]}
            />
            {s.people.map((p, i) => (
              <DataSheet
                key={i}
                rows={[
                  { label: `Person ${i + 1}`, value: p.legalName },
                  { label: 'Goes by', value: p.goesBy },
                  { label: 'Age and occupation', value: p.ageOccupation },
                  { label: 'Marital status', value: p.maritalStatus },
                  { label: 'Role', value: p.roleLabel },
                  { label: 'Signs', value: p.signs ? 'Yes' : 'No' },
                  { label: 'Discord', value: p.discord, mono: true },
                  { label: 'Roblox', value: p.robloxUsername, mono: true },
                  { label: 'Chirper', value: p.chirper, mono: true },
                ]}
              />
            ))}
            {s.background ? <p className="body muted prose">{s.background}</p> : null}
          </>
        ) : (
          <p className="body muted">No client file linked yet.</p>
        )}
      </section>

      <section className="stack">
        {head('Money and ownership', 'seller')}
        <DataSheet
          rows={[
            { label: 'How title is held', value: b.ownership?.vesting },
            { label: 'Who signs', value: b.ownership?.whoSigns },
            { label: 'Bought', value: [b.ownership?.boughtOn, b.ownership?.boughtFor ? money(b.ownership.boughtFor) : null].filter(Boolean).join(', ') },
            { label: 'Deed reference', value: b.ownership?.deedReference, mono: true },
            { label: 'Mortgage', value: b.ownership?.mortgage },
            { label: 'Liens', value: b.ownership?.liens },
            { label: 'Property taxes', value: b.details?.taxes },
            { label: 'HOA', value: b.details?.hoa },
          ]}
        />
      </section>

      <section className="stack">
        {head('Listing terms and showings', 'terms')}
        <DataSheet
          rows={[
            { label: b.purpose === 'rent' ? 'Monthly rent' : 'Asking price', value: b.price ? money(b.price) : '', mono: true },
            { label: 'Listing agreement', value: [b.terms?.agreementStart && date(b.terms.agreementStart), b.terms?.agreementEnd && date(b.terms.agreementEnd)].filter(Boolean).join(' to ') },
            { label: 'Earnest money expected', value: b.terms?.earnestMoneyExpected },
            { label: 'Settlement', value: b.terms?.targetSettlement },
            { label: 'Possession', value: b.terms?.possession },
            { label: 'Included', value: b.terms?.included },
            { label: 'Excluded', value: b.terms?.excluded },
            { label: 'Leased items', value: b.terms?.leasedItems },
            { label: 'Transfer tax', value: b.terms?.transferTax },
            { label: 'Title company', value: b.terms?.titleCompany },
            { label: 'Attorney', value: b.terms?.attorney },
            { label: 'Home warranty', value: b.terms?.homeWarranty },
            { label: 'Financing accepted', value: b.terms?.financingAccepted },
            { label: 'Offer replies', value: b.terms?.offerReplies },
            { label: 'Sold as-is', value: b.terms?.asIs ? 'Yes' : '' },
            { label: 'Showings', value: b.showingInstructions },
            { label: 'Yard sign', value: yn(b.terms?.yardSign) },
            { label: 'Photos allowed', value: yn(b.terms?.photosAllowed) },
            { label: 'Lockbox', value: yn(b.terms?.lockbox) },
          ]}
        />
      </section>

      {b.type !== 'business' ? (
        <section className="stack">
          {head('Disclosures', 'seller')}
          {b.disclosures.length ? (
            <DataSheet
              rows={b.disclosures.map((d) => ({
                label: DISCLOSURE_LABELS[d.item].label,
                value: [d.answer ? ANSWER[d.answer] : null, d.detail].filter(Boolean).join(' · '),
              }))}
            />
          ) : (
            <p className="body muted">No disclosures entered.</p>
          )}
        </section>
      ) : null}

      {editHref && !redacted ? (
        <Link className="no-print body-s" href={editHref('seller')}>
          Edit the confidential details
        </Link>
      ) : null}
      <ConfidentialPanel
        title="Confidential"
        note={redacted ? 'You don’t have access to these fields' : 'Agents only. Never tell a buyer.'}
        redacted={redacted}
        rows={
          redacted
            ? [{ label: 'Lowest they’ll take' }, { label: 'Negotiation rules' }, { label: 'Commission' }, { label: 'Motivation' }]
            : [
                { label: 'Lowest they’ll take', value: confidential?.bottomLine ? money(confidential.bottomLine) : '—', mono: true },
                { label: 'Negotiation rules', value: confidential?.negotiationRules || '—' },
                { label: 'Lines to relay', value: confidential?.relayLines || '—' },
                { label: 'Commission', value: confidential?.commissionTerms || clientConfidential?.commissionTerms || '—' },
                { label: 'Motivation', value: clientConfidential?.motivation || '—' },
                { label: 'Client negotiation notes', value: clientConfidential?.negotiationNotes || '—' },
                ...(b.type === 'business'
                  ? [
                      { label: 'Yearly sales', value: confidential?.yearlySales ? money(confidential.yearlySales) : '—', mono: true },
                      { label: 'Yearly owner profit', value: confidential?.yearlyProfit ? money(confidential.yearlyProfit) : '—', mono: true },
                      { label: 'Inventory', value: confidential?.inventoryValue ? money(confidential.inventoryValue) : '—', mono: true },
                    ]
                  : []),
              ]
        }
      />
    </div>
  );
}
