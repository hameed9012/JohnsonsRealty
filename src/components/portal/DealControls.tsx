'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { addOfferAction, recordSaleAction, updateDealAction, type OpResult } from '@/server/actions/ops';

function useSubmit() {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();
  const submit = (fn: () => Promise<OpResult<unknown>>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (r.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, errors, submit };
}

export function DealDetailsForm({ id, values }: { id: string; values: Record<'offerDate' | 'acceptedDate' | 'inspectionDeadline' | 'financingDeadline' | 'settlementDate' | 'notes', string> & { sharedWithClient: boolean } }) {
  const { pending, errors, submit } = useSubmit();
  const d = (k: keyof typeof values & string, label: string) => <TextField className="span-4" label={label} name={k} type="date" mono defaultValue={values[k] as string} error={errors[k]} />;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); submit(() => updateDealAction(id, fd)); }}>
      <div className="grid-12">
        {d('offerDate', 'Offer made')}
        {d('acceptedDate', 'Offer accepted')}
        {d('inspectionDeadline', 'Inspection deadline')}
        {d('financingDeadline', 'Financing deadline')}
        {d('settlementDate', 'Settlement')}
      </div>
      <TextField label="Deal notes (staff only)" name="notes" multiline rows={3} defaultValue={values.notes} error={errors.notes} />
      <Toggle name="sharedWithClient" label="Show this deal on the client’s account" hint="They see the stage, dates, shared documents and messages. Never the offers." defaultChecked={values.sharedWithClient} />
      <div className="row">
        <Button type="submit" variant="secondary" loading={pending}>
          Save deal details
        </Button>
      </div>
    </form>
  );
}

export function OfferForm({ id }: { id: string }) {
  const { pending, errors, submit } = useSubmit();
  const [key, setKey] = useState(0);
  return (
    <form key={key} className="stack" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); submit(() => addOfferAction(id, fd), () => setKey((k) => k + 1)); }}>
      <div className="grid-12">
        <TextField className="span-4" label="Amount ($)" name="amount" mono inputMode="numeric" error={errors.amount} />
        <SelectField className="span-4" label="From" name="by" placeholder="Choose" options={[{ value: 'buyer', label: 'Buyer' }, { value: 'seller', label: 'Seller (counter)' }]} error={errors.by} />
        <TextField className="span-4" label="Date" name="on" type="date" mono defaultValue={new Date().toISOString().slice(0, 10)} error={errors.on} />
      </div>
      <TextField label="Note (optional)" name="note" error={errors.note} />
      <div className="row">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Log offer
        </Button>
      </div>
    </form>
  );
}

export function RecordSaleForm({ id, rent, price, agents, dealAgentId }: { id: string; rent: boolean; price: string; agents: { value: string; label: string }[]; dealAgentId: string | null }) {
  const { pending, errors, submit } = useSubmit();
  const [rows, setRows] = useState([{ agentId: dealAgentId ?? '', ratePercent: '', amount: '', note: '' }]);
  const [salePrice, setSalePrice] = useState(price);
  const [soldOn, setSoldOn] = useState(new Date().toISOString().slice(0, 10));
  const [settledOn, setSettledOn] = useState('');
  const [buyerAgentId, setBuyerAgentId] = useState('');
  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          recordSaleAction(id, {
            price: salePrice,
            soldOn,
            settledOn: settledOn || null,
            buyerAgentId: buyerAgentId || null,
            commissions: rows.filter((r) => r.amount).map((r) => ({ agentId: r.agentId || null, ratePercent: r.ratePercent, amount: r.amount, note: r.note })),
          }),
        );
      }}
    >
      <div className="grid-12">
        <TextField className="span-4" label={rent ? 'Monthly rent ($)' : 'Sale price ($)'} mono inputMode="numeric" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} error={errors.price} />
        <TextField className="span-4" label={rent ? 'Lease signed' : 'Sold on'} type="date" mono value={soldOn} onChange={(e) => setSoldOn(e.target.value)} error={errors.soldOn} />
        <TextField className="span-4" label="Settled on (optional)" type="date" mono value={settledOn} onChange={(e) => setSettledOn(e.target.value)} error={errors.settledOn} />
        <SelectField className="span-6" label={rent ? 'Tenant’s agent (optional)' : 'Buyer’s agent (optional)'} placeholder="None" options={agents} value={buyerAgentId} onChange={(e) => setBuyerAgentId(e.target.value)} error={errors.buyerAgentId} />
      </div>
      <fieldset className="jr-fieldset stack">
        <legend>Commission (confidential)</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid-12">
            <SelectField className="span-4" label="Agent" placeholder="Brokerage" options={agents} value={r.agentId} onChange={(e) => setRow(i, { agentId: e.target.value })} />
            <TextField className="span-3" label="Rate (%)" mono inputMode="decimal" value={r.ratePercent} onChange={(e) => setRow(i, { ratePercent: e.target.value })} error={errors[`commissions.${i}.ratePercent`]} />
            <TextField className="span-3" label="Amount ($)" mono inputMode="numeric" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} error={errors[`commissions.${i}.amount`]} />
            <div className="span-3">
              {rows.length > 1 ? (
                <Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        <div>
          <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { agentId: '', ratePercent: '', amount: '', note: '' }])}>
            Add a commission split
          </Button>
        </div>
      </fieldset>
      <div className="row">
        <Button type="submit" withKey loading={pending}>
          {rent ? 'Record lease' : 'Record sale'}
        </Button>
        <span className="body-s muted">Takes the next Sale No., marks the listing {rent ? 'Leased' : 'Sold'} and closes the deal.</span>
      </div>
    </form>
  );
}
