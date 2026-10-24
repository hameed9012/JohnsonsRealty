'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox, RadioGroup } from '@/components/ui/controls';
import { Icon } from '@/components/ui/Icon';
import { SelectField, TextField } from '@/components/ui/fields';
import { DISCLOSURE_LABELS } from '@/lib/schemas/listing';
import type { ClientValues, EditorOptions, PersonValues, SellerValues } from './types';
import type { useStepForm } from './useStepForm';

type Form = ReturnType<typeof useStepForm<SellerValues>>;

const EMPTY_PERSON: PersonValues = { legalName: '', goesBy: '', ageOccupation: '', maritalStatus: '', signs: true, roleLabel: '', discord: '', robloxUsername: '', chirper: '' };
const EMPTY_CLIENT: ClientValues = {
  kind: 'person',
  displayName: '',
  legalNameOnForms: '',
  source: '',
  bestContact: '',
  emergencyContact: '',
  businessAddress: '',
  currentlyOccupying: '',
  mailingAddressAfter: '',
  reason: '',
  timeline: '',
  whoDecides: '',
  background: '',
  generatedSeed: '',
  people: [{ ...EMPTY_PERSON }],
};

/** Form fields inside the hatched confidential panel. */
export function ConfidentialFieldset({ title = 'Confidential', note = 'Agents only', children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="jr-conf" aria-label={title}>
      <div className="jr-conf-head">
        <Icon name="lock" size={16} />
        {title}
        <small>{note}</small>
      </div>
      <div className="conf-body stack">{children}</div>
    </section>
  );
}

export function SellerFields({
  form,
  options,
  type,
  confidential,
  generate,
}: {
  form: Form;
  options: EditorOptions;
  type: string;
  confidential: boolean;
  /** Fetches a generated (fictional RP) seller as form values; regenerate picks a new seed. */
  generate?: (regenerate: boolean) => Promise<SellerValues | null>;
}) {
  const { values: v, set, bind, errors } = form;
  const [generating, startGenerate] = useTransition();
  const c = v.client;
  const setClient = (patch: Partial<ClientValues>) => set('client', { ...c, ...patch });
  const setPerson = (i: number, patch: Partial<PersonValues>) => setClient({ people: c.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const cBind = (k: keyof Omit<ClientValues, 'people'>) => ({
    name: `client.${k}`,
    value: c[k],
    onChange: (e: { target: { value: string } }) => setClient({ [k]: e.target.value } as Partial<ClientValues>),
    error: errors[`client.${k}`],
  });
  const confBind = (k: keyof SellerValues['clientConfidential']) => ({
    name: `clientConfidential.${k}`,
    value: v.clientConfidential[k],
    onChange: (e: { target: { value: string } }) => set('clientConfidential', { ...v.clientConfidential, [k]: e.target.value }),
  });

  return (
    <div className="stack-lg">
      <fieldset className="jr-fieldset stack">
        <legend>Client file</legend>
        <SelectField
          label="Seller"
          name="clientId"
          placeholder="New client file"
          options={options.clients.map((x) => ({ value: x.id, label: x.label }))}
          value={v.clientId}
          error={errors.clientId}
          hint="Pick an existing client file to fill it in, leave on “New client file”, or generate a fictional seller."
          onChange={(e) => {
            const id = e.target.value;
            const found = options.clients.find((x) => x.id === id);
            set('clientId', id);
            set('client', found ? found.client : { ...EMPTY_CLIENT });
            if (found?.confidential) set('clientConfidential', found.confidential);
          }}
        />
        {generate ? (
          <div className="row">
            <Button
              variant="secondary"
              size="sm"
              icon="user"
              loading={generating}
              onClick={() =>
                startGenerate(async () => {
                  const again = !!c.generatedSeed;
                  if (again && !confirm('Replace this generated seller with a new one?')) return;
                  const g = await generate(again);
                  if (!g) return;
                  // Regenerating updates the same client file instead of opening another.
                  const keep = again ? v.clientId : '';
                  for (const k of Object.keys(g) as (keyof SellerValues)[]) set(k, k === 'clientId' ? keep : g[k]);
                })
              }
            >
              {c.generatedSeed ? 'Regenerate seller' : 'Generate a seller'}
            </Button>
            {c.generatedSeed ? <span className="label label--brass">Fictional RP seller</span> : <span className="body-s muted">For in-game houses with no real seller. Skip this step and one is generated when the Owner approves.</span>}
          </div>
        ) : null}
        <RadioGroup
          legend="Who is selling?"
          name="client.kind"
          value={c.kind}
          onChange={(k) => setClient({ kind: k })}
          options={[
            { value: 'person', label: 'A person' },
            { value: 'couple', label: 'A couple or co-owners' },
            { value: 'company', label: 'A company' },
            { value: 'estate', label: 'An estate' },
          ]}
        />
        <div className="grid-12">
          <TextField className="span-6" label="Client name" {...cBind('displayName')} placeholder="Priya and Daniel Raman" />
          <TextField className="span-6" label="Name on forms" {...cBind('legalNameOnForms')} hint="Exactly as it appears on paperwork, if different." />
        </div>
      </fieldset>

      <fieldset className="jr-fieldset stack">
        <legend>People</legend>
        {c.people.map((p, i) => (
          <div key={i} className="panel stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 className="heading-3">Person {i + 1}</h3>
              {c.people.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => setClient({ people: c.people.filter((_, j) => j !== i) })}>
                  Remove person {i + 1}
                </Button>
              ) : null}
            </div>
            <div className="grid-12">
              <TextField className="span-6" label="Full legal name" name={`people.${i}.legalName`} value={p.legalName} onChange={(e) => setPerson(i, { legalName: e.target.value })} error={errors[`client.people.${i}.legalName`]} />
              <TextField className="span-6" label="Goes by" name={`people.${i}.goesBy`} value={p.goesBy} onChange={(e) => setPerson(i, { goesBy: e.target.value })} />
              <TextField className="span-6" label="Age and occupation" name={`people.${i}.ageOccupation`} value={p.ageOccupation} onChange={(e) => setPerson(i, { ageOccupation: e.target.value })} />
              <TextField className="span-6" label="Marital status" name={`people.${i}.maritalStatus`} value={p.maritalStatus} onChange={(e) => setPerson(i, { maritalStatus: e.target.value })} />
              <TextField className="span-6" label="Role" name={`people.${i}.roleLabel`} value={p.roleLabel} onChange={(e) => setPerson(i, { roleLabel: e.target.value })} placeholder="Executor, managing member, adviser" />
              <TextField className="span-6" label="Discord" mono name={`people.${i}.discord`} value={p.discord} onChange={(e) => setPerson(i, { discord: e.target.value })} />
              <TextField className="span-6" label="Roblox username" mono name={`people.${i}.robloxUsername`} value={p.robloxUsername} onChange={(e) => setPerson(i, { robloxUsername: e.target.value })} />
              <TextField className="span-6" label="Chirper" mono name={`people.${i}.chirper`} value={p.chirper} onChange={(e) => setPerson(i, { chirper: e.target.value })} />
            </div>
            <Checkbox label="Signs the paperwork" checked={p.signs} onChange={(e) => setPerson(i, { signs: e.target.checked })} />
          </div>
        ))}
        <div>
          <Button variant="secondary" size="sm" icon="user" onClick={() => setClient({ people: [...c.people, { ...EMPTY_PERSON }] })}>
            Add another person
          </Button>
        </div>
      </fieldset>

      <fieldset className="jr-fieldset stack">
        <legend>Contact and situation</legend>
        <div className="grid-12">
          <TextField className="span-6" label="Best way to reach them" {...cBind('bestContact')} />
          <TextField className="span-6" label="How they found us" {...cBind('source')} />
          <TextField className="span-6" label="Living in the property now?" {...cBind('currentlyOccupying')} />
          <TextField className="span-6" label="Mailing address after the move" {...cBind('mailingAddressAfter')} />
          <TextField className="span-6" label="Reason for selling" {...cBind('reason')} />
          <TextField className="span-6" label="Timeline" {...cBind('timeline')} />
          <TextField className="span-6" label="Who helps them decide" {...cBind('whoDecides')} />
          {c.kind === 'company' ? <TextField className="span-6" label="Business address" {...cBind('businessAddress')} /> : null}
        </div>
        <TextField label="Background" multiline rows={3} {...cBind('background')} hint="Who they are, in a few sentences. Staff only." />
      </fieldset>

      <fieldset className="jr-fieldset stack">
        <legend>Ownership and money</legend>
        <div className="grid-12">
          <TextField className="span-6" label="How title is held" {...bind('vesting')} placeholder="Sole owner" />
          <TextField className="span-6" label="Who signs" {...bind('whoSigns')} />
          <TextField className="span-4" label="Bought" {...bind('boughtOn')} placeholder="June 2000" />
          <TextField className="span-4" label="Bought for ($)" mono inputMode="numeric" {...bind('boughtFor')} />
          <TextField className="span-4" label="Deed reference" mono {...bind('deedReference')} placeholder="Deed Book 3381, Page 204" />
          <TextField className="span-6" label="Mortgage" {...bind('mortgage')} />
          <TextField className="span-6" label="Liens" {...bind('liens')} />
        </div>
      </fieldset>

      {type !== 'business' ? (
        <fieldset className="jr-fieldset stack">
          <legend>Disclosures (Form JR-PA-060)</legend>
          <div className="dt-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Known problem?</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {v.disclosures.map((d, i) => {
                  const meta = DISCLOSURE_LABELS[d.item as keyof typeof DISCLOSURE_LABELS];
                  const update = (patch: Partial<typeof d>) => set('disclosures', v.disclosures.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <tr key={d.item}>
                      <td data-label="Item">{meta.label}</td>
                      <td data-label="Known problem?">
                        <select className="jr-field-input" aria-label={`${meta.label}: known problem?`} value={d.answer} onChange={(e) => update({ answer: e.target.value })}>
                          <option value="">Not answered</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                          <option value="unknown">Unknown</option>
                          <option value="na">N/A</option>
                        </select>
                      </td>
                      <td data-label="Details">
                        <input className="jr-field-input" aria-label={`${meta.label}: details`} placeholder={meta.hint} value={d.detail} onChange={(e) => update({ detail: e.target.value })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </fieldset>
      ) : null}

      {confidential ? (
        <ConfidentialFieldset note="Agents only. Never shown to buyers or the seller’s account.">
          <div className="grid-12">
            <TextField className="span-6" label="Lowest they’ll take ($)" mono inputMode="numeric" {...bind('bottomLine')} />
            <TextField className="span-6" label="Commission terms" {...bind('commissionTerms')} placeholder="5% total, 2.5% to each side" />
            {type === 'business' ? (
              <>
                <TextField className="span-4" label="Yearly sales ($)" mono inputMode="numeric" {...bind('yearlySales')} />
                <TextField className="span-4" label="Yearly owner profit ($)" mono inputMode="numeric" {...bind('yearlyProfit')} />
                <TextField className="span-4" label="Inventory value ($)" mono inputMode="numeric" {...bind('inventoryValue')} />
              </>
            ) : null}
          </div>
          <TextField label="Motivation" multiline rows={2} {...confBind('motivation')} />
          <TextField label="Negotiation rules" multiline rows={4} {...bind('negotiationRules')} hint="What they accept, counter and decline." />
          <TextField label="Lines you can relay" multiline rows={3} {...bind('relayLines')} />
          <TextField label="Client negotiation notes" multiline rows={3} {...confBind('negotiationNotes')} />
        </ConfidentialFieldset>
      ) : (
        <ConfidentialFieldset>
          <p className="body-s muted">Only the listing agent and the Owner can see or edit the confidential details.</p>
        </ConfidentialFieldset>
      )}
    </div>
  );
}

export function OwnerFields({ form, account }: { form: ReturnType<typeof useStepForm<import('./types').OwnerValues>>; account?: EditorOptions['account'] }) {
  const { values: v, set, bind } = form;
  const c = v.ownerContact;
  return (
    <div className="stack-lg">
      <p className="body muted prose">We use these details for your seller file and paperwork. Our agents see them; the public only sees what you choose below.</p>
      <div className="grid-12">
        <TextField className="span-6" label="Your name for paperwork" {...bind('legalName')} />
        <TextField className="span-6" label="Co-owners (optional)" {...bind('coOwners')} hint="Anyone else on the title." />
        <TextField className="span-6" label="Best way to reach you" {...bind('bestContact')} placeholder="Discord DM, evenings" />
        <TextField className="span-6" label="When do you want to sell or let?" {...bind('timeline')} />
      </div>
      <TextField label="Why are you selling or letting? (optional)" multiline rows={2} {...bind('reason')} />
      <fieldset className="jr-fieldset stack">
        <legend>Show on the public listing</legend>
        <Checkbox
          label={account?.robloxUsername ? <>Roblox username <span className="id">{account.robloxUsername}</span></> : 'Roblox username (add it in your profile)'}
          checked={c.roblox}
          disabled={!account?.robloxUsername}
          onChange={(e) => set('ownerContact', { ...c, roblox: e.target.checked })}
        />
        <Checkbox
          label={account?.chirperHandle ? <>Chirper <span className="id">@{account.chirperHandle}</span></> : 'Chirper handle (add it in your profile)'}
          checked={c.chirper}
          disabled={!account?.chirperHandle}
          onChange={(e) => set('ownerContact', { ...c, chirper: e.target.checked })}
        />
        <Checkbox label={<>Discord name {account?.displayName ? <span className="id">{account.displayName}</span> : null}</>} checked={c.discord} onChange={(e) => set('ownerContact', { ...c, discord: e.target.checked })} />
      </fieldset>
    </div>
  );
}
