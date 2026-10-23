'use client';

import { Toggle, FeatureChips, RadioGroup } from '@/components/ui/controls';
import { TextField } from '@/components/ui/fields';
import { LISTING_TYPES, TYPE_LABELS } from '@/lib/schemas/listing';
import type { EditorOptions, PropertyValues } from './types';
import type { useStepForm } from './useStepForm';

type Form = ReturnType<typeof useStepForm<PropertyValues>>;

export function PropertyFields({ form, options, simple }: { form: Form; options: EditorOptions; simple?: boolean }) {
  const { values: v, set, bind, errors } = form;
  const home = v.type === 'house' || v.type === 'apartment' || v.type === 'rental';
  const biz = v.type === 'business';
  return (
    <div className="stack-lg">
      <RadioGroup
        legend="What kind of property is it?"
        name="type"
        value={v.type}
        onChange={(t) => {
          set('type', t);
          if (t === 'rental') set('purpose', 'rent');
          if (t === 'land' && v.purpose === 'rent') set('purpose', 'sale');
        }}
        options={LISTING_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        error={errors.type}
      />
      {v.type !== 'rental' ? (
        <RadioGroup
          legend="For sale or for rent?"
          name="purpose"
          value={v.purpose}
          onChange={(p) => set('purpose', p)}
          options={[
            { value: 'sale', label: 'For sale' },
            { value: 'rent', label: 'For rent' },
          ]}
          error={errors.purpose}
        />
      ) : null}

      <fieldset className="jr-fieldset stack">
        <legend>Address</legend>
        <div className="grid-12">
          <TextField className="span-8" label="Street address" {...bind('addressLine')} placeholder="7063 Franklin Court" autoComplete="off" />
          <TextField className="span-4" label="Unit (optional)" {...bind('unit')} />
        </div>
        <fieldset className="jr-fieldset">
          <legend>Area</legend>
          <div className="jr-featurechips" role="radiogroup" aria-label="Area">
            {options.areas.map((a) => (
              <label key={a.value} className="jr-featurechip">
                <input
                  type="radio"
                  name="areaId"
                  value={a.value}
                  checked={v.areaId === a.value}
                  onChange={() => {
                    set('areaId', a.value);
                    if (!v.postalCode && a.postalCodes.length === 1) set('postalCode', a.postalCodes[0]!);
                  }}
                />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
          {errors.areaId ? <p className="jr-field-hint" style={{ color: 'var(--danger)' }}>{errors.areaId}</p> : null}
        </fieldset>
        <div className="grid-12">
          <TextField className="span-6" label="Postal code" mono {...bind('postalCode')} hint="The in-game postal code." />
          {!simple ? <TextField className="span-6" label="Parcel ID (optional)" mono {...bind('parcelId')} placeholder="63-018-061" /> : null}
        </div>
      </fieldset>

      <fieldset className="jr-fieldset stack">
        <legend>Facts</legend>
        <div className="grid-12">
          {home ? (
            <>
              <TextField className="span-3" label="Bedrooms" mono inputMode="numeric" {...bind('beds')} />
              <TextField className="span-3" label="Bathrooms" mono inputMode="decimal" {...bind('baths')} hint="Halves allowed, like 1.5." />
            </>
          ) : null}
          <TextField className="span-3" label="Living space (sq ft)" mono inputMode="numeric" {...bind('sqft')} />
          <TextField className="span-3" label="Lot size" {...bind('lot')} placeholder="0.22 acres" />
          <TextField className="span-3" label="Year built" mono inputMode="numeric" {...bind('yearBuilt')} />
          <TextField className="span-6" label="Garage" {...bind('garage')} placeholder="Single-car attached" />
        </div>
        {options.features.length ? (
          <FeatureChips
            legend="Features"
            name="featureIds"
            options={options.features}
            selected={v.featureIds}
            onToggle={(id, on) => set('featureIds', on ? [...v.featureIds, id] : v.featureIds.filter((x) => x !== id))}
          />
        ) : null}
      </fieldset>

      {biz ? (
        <fieldset className="jr-fieldset stack">
          <legend>Business</legend>
          <div className="grid-12">
            <TextField className="span-6" label="Business name" {...bind('businessName')} />
            <TextField className="span-6" label="Kind of business" {...bind('businessType')} placeholder="Restaurant / diner" />
          </div>
          <Toggle
            label="Keep the name off the public listing"
            hint="Buyers see the public line below until they sign a confidentiality agreement."
            checked={v.nameWithheld}
            onChange={(e) => set('nameWithheld', e.target.checked)}
          />
          {v.nameWithheld ? <TextField label="Public line" {...bind('teaser')} placeholder="Established diner, Swatara Township" /> : null}
          <div className="grid-12">
            <TextField className="span-3" label="Opened (year)" mono inputMode="numeric" {...bind('openedYear')} />
            <TextField className="span-3" label="Staff" mono inputMode="numeric" {...bind('employees')} />
            <TextField className="span-3" label="Seats" mono inputMode="numeric" {...bind('seats')} />
            <TextField className="span-3" label="Hours" {...bind('hours')} />
            <TextField className="span-6" label="What’s being sold" {...bind('whatIsSold')} placeholder="Business and building" />
            <TextField className="span-6" label="Building" {...bind('buildingSize')} />
          </div>
          <TextField label="Trading history (public)" multiline rows={3} {...bind('tradingHistory')} hint="A plain summary. Exact sales and profit go in the confidential section." />
        </fieldset>
      ) : null}

      <TextField
        label="Description"
        multiline
        rows={7}
        {...bind('description')}
        hint="Lead with facts: rooms, condition, what’s included. Be honest about trade-offs."
      />

      {home && !simple ? (
        <details className="panel">
          <summary className="heading-3">Home systems and running costs</summary>
          <p className="body-s muted">For the seller file and documents. Shown in the public facts when filled in.</p>
          <div className="grid-12" style={{ marginTop: 'var(--space-4)' }}>
            {(
              [
                ['propertyStyle', 'Style', 'Single-family detached, two storeys'],
                ['otherRooms', 'Other rooms', 'Home office, formal dining room'],
                ['parking', 'Parking', 'Driveway for two more cars'],
                ['basement', 'Basement', 'Full, unfinished, sump pump'],
                ['heating', 'Heating', 'Gas forced air, 2019'],
                ['cooling', 'Cooling', 'Central air, 2019'],
                ['waterHeater', 'Water heater', '50-gallon gas, 2014'],
                ['waterSewer', 'Water and sewer', 'Public water, public sewer'],
                ['electrical', 'Electrical', '200-amp service'],
                ['roof', 'Roof', 'Asphalt shingle, 2017'],
                ['windows', 'Windows', ''],
                ['appliancesProvided', 'Appliances provided', ''],
                ['furnished', 'Furnished', ''],
                ['taxes', 'Property taxes', 'About $6,200 per year'],
                ['hoa', 'HOA', 'None'],
                ['utilities', 'Average utilities', 'About $310 per month'],
                ['zoning', 'Zoning', ''],
                ['occupancy', 'Occupancy', 'Owner-occupied until settlement'],
              ] as const
            ).map(([k, label, ph]) => (
              <TextField key={k} className="span-6" label={label} {...bind(k)} placeholder={ph || undefined} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
