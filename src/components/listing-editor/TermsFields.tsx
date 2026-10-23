'use client';

import { Toggle } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import type { TermsValues } from './types';
import type { useStepForm } from './useStepForm';

type Form = ReturnType<typeof useStepForm<TermsValues>>;

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function TermsFields({ form, purpose, type, simple }: { form: Form; purpose: string; type: string; simple?: boolean }) {
  const { values: v, set, bind } = form;
  const rent = purpose === 'rent';
  const biz = type === 'business';
  const T = (k: keyof TermsValues & string, label: string, extra: Record<string, unknown> = {}) => <TextField label={label} {...bind(k)} {...extra} />;

  return (
    <div className="stack-lg">
      <fieldset className="jr-fieldset stack">
        <legend>{rent ? 'Rent' : 'Price'}</legend>
        <div className="grid-12">
          <div className="span-6">{T('price', rent ? 'Monthly rent ($)' : 'Asking price ($)', { mono: true, inputMode: 'numeric', placeholder: rent ? '1900' : '365000', hint: 'Dollars, no cents.' })}</div>
          <div className="span-6">{T('availableFrom', 'Available from', { type: 'date', mono: true })}</div>
        </div>
      </fieldset>

      {rent ? (
        <fieldset className="jr-fieldset stack">
          <legend>Lease terms</legend>
          <div className="grid-12">
            <div className="span-4">{T('leaseLengthMonths', 'Lease length (months)', { mono: true, inputMode: 'numeric', placeholder: '12' })}</div>
            <div className="span-4">{T('deposit', 'Security deposit ($)', { mono: true, inputMode: 'numeric', placeholder: '1900' })}</div>
            <div className="span-4">{T('dueAtSigning', 'Due at signing', { placeholder: 'First month and deposit' })}</div>
            <div className="span-4">{T('rentDue', 'Rent due', { placeholder: '1st of each month' })}</div>
            <div className="span-4">{T('lateFee', 'Late fee')}</div>
            <div className="span-4">{T('maxOccupants', 'Most occupants', { mono: true, inputMode: 'numeric' })}</div>
            <div className="span-6">{T('pets', 'Pets')}</div>
            <div className="span-6">{T('smoking', 'Smoking')}</div>
            <div className="span-6">{T('leaseUtilities', 'Utilities', { placeholder: 'Tenant pays electric, gas and internet' })}</div>
            <div className="span-6">{T('renewal', 'Renewal')}</div>
            {!simple ? (
              <>
                <div className="span-6">{T('paymentMethod', 'How rent is paid')}</div>
                <div className="span-6">{T('yardAndSnow', 'Yard and snow')}</div>
                <div className="span-6">{T('subletting', 'Subletting')}</div>
                <div className="span-6">{T('insurance', 'Renter’s insurance')}</div>
                <div className="span-6">{T('moveInInspection', 'Move-in inspection')}</div>
                <div className="span-6">{T('leasingFee', 'Leasing fee')}</div>
              </>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {rent ? (
        <fieldset className="jr-fieldset stack">
          <legend>What applicants need</legend>
          <div className="grid-12">
            <div className="span-6">{T('incomeRequirement', 'Income', { placeholder: 'At least 3 times the rent' })}</div>
            <div className="span-6">{T('checks', 'Checks', { placeholder: 'Credit and background check' })}</div>
            <div className="span-4">{T('references', 'References')}</div>
            <div className="span-4">{T('applicationFee', 'Application fee')}</div>
            <div className="span-4">{T('decisionTime', 'Decision time')}</div>
          </div>
        </fieldset>
      ) : null}

      {biz ? (
        <fieldset className="jr-fieldset stack">
          <legend>Business terms</legend>
          <div className="grid-12">
            <div className="span-3">{T('priceBuilding', 'Building ($)', { mono: true, inputMode: 'numeric' })}</div>
            <div className="span-3">{T('priceEquipment', 'Equipment ($)', { mono: true, inputMode: 'numeric' })}</div>
            <div className="span-3">{T('priceInventory', 'Inventory ($)', { mono: true, inputMode: 'numeric' })}</div>
            <div className="span-3">{T('priceGoodwill', 'Goodwill and name ($)', { mono: true, inputMode: 'numeric' })}</div>
            <div className="span-6">{T('ownerFinancing', 'Owner financing', { placeholder: 'Up to 20% over five years at 7%' })}</div>
            <div className="span-6">{T('training', 'Training')}</div>
            <div className="span-6">{T('nonCompete', 'Non-compete')}</div>
            <div className="span-6">{T('staffTerms', 'Staff')}</div>
            <div className="span-4">{T('premisesRent', 'Premises rent (if leased)')}</div>
            <div className="span-4">{T('premisesLeaseEnd', 'Lease ends')}</div>
            <div className="span-4">{T('premisesLandlord', 'Landlord')}</div>
          </div>
          {T('licences', 'Licences', { multiline: true, rows: 2 })}
          <Toggle
            label="Confidential sale"
            hint="Staff and customers must not be told. Buyers sign a confidentiality agreement first."
            checked={v.businessConfidential}
            onChange={(e) => set('businessConfidential', e.target.checked)}
          />
        </fieldset>
      ) : null}

      <fieldset className="jr-fieldset stack">
        <legend>What’s included</legend>
        {T('included', 'Included', { multiline: true, rows: 2 })}
        {T('excluded', 'Excluded', { multiline: true, rows: 2 })}
      </fieldset>

      <fieldset className="jr-fieldset stack">
        <legend>Showings</legend>
        {T('showingInstructions', 'Showing instructions', { multiline: true, rows: 3, hint: 'Notice needed, lockbox, pets, who lets people in.' })}
        {!simple ? (
          <div className="grid-12">
            <SelectField className="span-4" label="Yard sign" placeholder="Not decided" options={YES_NO} {...bind('yardSign')} />
            <SelectField className="span-4" label="Photos allowed" placeholder="Not decided" options={YES_NO} {...bind('photosAllowed')} />
            <SelectField className="span-4" label="Lockbox" placeholder="Not decided" options={YES_NO} {...bind('lockbox')} />
          </div>
        ) : null}
      </fieldset>

      {!rent && !simple ? (
        <details className="panel">
          <summary className="heading-3">Listing terms for the contract</summary>
          <div className="grid-12" style={{ marginTop: 'var(--space-4)' }}>
            <div className="span-6">{T('agreementStart', 'Listing agreement starts', { type: 'date', mono: true })}</div>
            <div className="span-6">{T('agreementEnd', 'Listing agreement ends', { type: 'date', mono: true })}</div>
            <div className="span-6">{T('earnestMoneyExpected', 'Earnest money expected')}</div>
            <div className="span-6">{T('targetSettlement', 'Target settlement')}</div>
            <div className="span-6">{T('possession', 'Possession', { placeholder: 'At settlement' })}</div>
            <div className="span-6">{T('leasedItems', 'Leased items')}</div>
            <div className="span-6">{T('transferTax', 'Realty transfer tax', { placeholder: 'Split equally' })}</div>
            <div className="span-6">{T('titleCompany', 'Title company')}</div>
            <div className="span-6">{T('attorney', 'Attorney')}</div>
            <div className="span-6">{T('homeWarranty', 'Home warranty')}</div>
            <div className="span-6">{T('financingAccepted', 'Financing accepted', { placeholder: 'Conventional, FHA, VA or cash' })}</div>
            <div className="span-6">{T('offerReplies', 'Offer replies', { placeholder: 'Within 24 hours' })}</div>
            <div className="span-6">{T('showingNotice', 'Showing notice', { placeholder: '24 hours' })}</div>
          </div>
          <Toggle label="Sold as-is" checked={v.asIs} onChange={(e) => set('asIs', e.target.checked)} />
        </details>
      ) : null}
    </div>
  );
}
