'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ClientConfValues, ClientValues, PersonValues } from '@/components/listing-editor/types';
import { ConfidentialFieldset } from '@/components/listing-editor/SellerFields';
import { Button } from '@/components/ui/Button';
import { Checkbox, FeatureChips, RadioGroup } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { saveClientAction } from '@/server/actions/ops';

const EMPTY_PERSON: PersonValues = { legalName: '', goesBy: '', ageOccupation: '', maritalStatus: '', signs: true, roleLabel: '', discord: '', robloxUsername: '', chirper: '' };
const ROLES = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'business_owner', label: 'Business owner' },
];

export interface ClientFileFormProps {
  id: string | null;
  client: ClientValues;
  confidential: ClientConfValues | null;
  roles: string[];
  agentId: string | null;
  agents: { value: string; label: string }[] | null;
}

export function ClientFileForm(p: ClientFileFormProps) {
  const [c, setC] = useState(p.client);
  const [conf, setConf] = useState(p.confidential);
  const [roles, setRoles] = useState(p.roles);
  const [agentId, setAgentId] = useState(p.agentId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = (patch: Partial<ClientValues>) => setC({ ...c, ...patch });
  const setPerson = (i: number, patch: Partial<PersonValues>) => set({ people: c.people.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const f = (k: keyof Omit<ClientValues, 'people'>, label: string, extra: Record<string, unknown> = {}) => (
    <TextField label={label} name={k} value={c[k]} error={errors[`client.${k}`]} onChange={(e) => set({ [k]: e.target.value } as Partial<ClientValues>)} {...extra} />
  );

  return (
    <form
      className="stack-lg"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveClientAction(p.id, { client: c, confidential: conf ?? undefined, roles, ...(p.agents ? { agentId: agentId || null } : {}) });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            toast({ message: r.message ?? 'Couldn’t save.', tone: 'danger' });
            return;
          }
          toast({ message: r.message ?? 'Saved', tone: 'success' });
          router.push(`/portal/clients/${r.data}`);
          router.refresh();
        });
      }}
    >
      <section className="panel stack">
        <h2 className="panel-title">Who they are</h2>
        <RadioGroup
          legend="Kind"
          name="kind"
          value={c.kind}
          onChange={(k) => set({ kind: k })}
          options={[
            { value: 'person', label: 'A person' },
            { value: 'couple', label: 'A couple or co-owners' },
            { value: 'company', label: 'A company' },
            { value: 'estate', label: 'An estate' },
          ]}
        />
        <div className="grid-12">
          <div className="span-6">{f('displayName', 'Client name', { required: true })}</div>
          <div className="span-6">{f('legalNameOnForms', 'Name on forms')}</div>
        </div>
        <FeatureChips legend="Roles" name="roles" options={ROLES} selected={roles} onToggle={(v, on) => setRoles(on ? [...roles, v] : roles.filter((r) => r !== v))} />
        {p.agents ? <SelectField label="Responsible agent" name="agentId" placeholder="Nobody yet" options={p.agents} value={agentId} onChange={(e) => setAgentId(e.target.value)} /> : null}
      </section>

      <section className="panel stack">
        <h2 className="panel-title">People</h2>
        {c.people.map((x, i) => (
          <div key={i} className="stack client-person">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3 className="heading-3">Person {i + 1}</h3>
              {c.people.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => set({ people: c.people.filter((_, j) => j !== i) })}>
                  Remove person {i + 1}
                </Button>
              ) : null}
            </div>
            <div className="grid-12">
              {(
                [
                  ['legalName', 'Full legal name'],
                  ['goesBy', 'Goes by'],
                  ['ageOccupation', 'Age and occupation'],
                  ['maritalStatus', 'Marital status'],
                  ['roleLabel', 'Role'],
                  ['discord', 'Discord'],
                  ['robloxUsername', 'Roblox username'],
                  ['chirper', 'Chirper'],
                ] as const
              ).map(([k, label]) => (
                <TextField key={k} className="span-6" label={label} name={`people.${i}.${k}`} mono={k === 'discord' || k === 'robloxUsername' || k === 'chirper'} value={x[k]} onChange={(e) => setPerson(i, { [k]: e.target.value })} />
              ))}
            </div>
            <Checkbox label="Signs the paperwork" checked={x.signs} onChange={(e) => setPerson(i, { signs: e.target.checked })} />
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon="user" onClick={() => set({ people: [...c.people, { ...EMPTY_PERSON }] })}>
            Add another person
          </Button>
        </div>
      </section>

      <section className="panel stack">
        <h2 className="panel-title">Contact and situation</h2>
        <div className="grid-12">
          <div className="span-6">{f('bestContact', 'Best way to reach them')}</div>
          <div className="span-6">{f('source', 'How they found us')}</div>
          <div className="span-6">{f('currentlyOccupying', 'Living in the property now?')}</div>
          <div className="span-6">{f('mailingAddressAfter', 'Mailing address after the move')}</div>
          <div className="span-6">{f('reason', 'Reason for moving')}</div>
          <div className="span-6">{f('timeline', 'Timeline')}</div>
          <div className="span-6">{f('whoDecides', 'Who helps them decide')}</div>
          <div className="span-6">{f('emergencyContact', 'Emergency contact')}</div>
          <div className="span-6">{f('businessAddress', 'Business address')}</div>
        </div>
        {f('background', 'Background', { multiline: true, rows: 3 })}
      </section>

      {conf ? (
        <ConfidentialFieldset note="Agents only. Never shown to the client.">
          {(
            [
              ['motivation', 'Motivation'],
              ['negotiationNotes', 'Negotiation notes'],
              ['relayLines', 'Lines you can relay'],
              ['commissionTerms', 'Commission terms'],
            ] as const
          ).map(([k, label]) => (
            <TextField key={k} label={label} name={k} multiline rows={k === 'commissionTerms' ? 1 : 3} value={conf[k]} onChange={(e) => setConf({ ...conf, [k]: e.target.value })} />
          ))}
        </ConfidentialFieldset>
      ) : (
        <ConfidentialFieldset note="You don’t have access to these fields">
          <p className="body-s muted">Only the client’s agent and the Owner can see the confidential notes.</p>
        </ConfidentialFieldset>
      )}

      <div className="row">
        <Button type="submit" loading={pending}>
          Save client file
        </Button>
        <Button variant="ghost" href={p.id ? `/portal/clients/${p.id}` : '/portal/clients'}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
