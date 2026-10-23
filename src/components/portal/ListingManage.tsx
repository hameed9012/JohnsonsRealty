'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { RadioGroup } from '@/components/ui/controls';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { createDealAction, saveLiveEdit, setListingPrice, setListingStatus, type OpResult } from '@/server/actions/ops';

export interface ListingManageProps {
  id: string;
  purpose: 'sale' | 'rent';
  statusOptions: { value: string; label: string }[];
  price: string;
  live: { description: string; showingInstructions: string; beds: string; baths: string; sqft: string };
  pendingRevision: boolean;
  reviewNote: string | null;
  clients: { value: string; label: string }[];
}

function useOp() {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const go = <T,>(fn: () => Promise<OpResult<T>>, onOk?: (r: OpResult<T>) => void, onErr?: (e: Record<string, string>) => void) =>
    start(async () => {
      const r = await fn();
      if (r.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
      if (r.ok) {
        onOk?.(r);
        router.refresh();
      } else if (r.fieldErrors) onErr?.(r.fieldErrors);
    });
  return { pending, go, router };
}

export function ListingManage(p: ListingManageProps) {
  const [status, setStatus] = useState('');
  const [price, setPrice] = useState(p.price);
  const [live, setLive] = useState(p.live);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dealClient, setDealClient] = useState('');
  const [side, setSide] = useState(p.purpose === 'rent' ? 'tenant' : 'buyer');
  const s1 = useOp();
  const s2 = useOp();
  const s3 = useOp();
  const s4 = useOp();
  const bind = (k: keyof typeof live) => ({ name: k, value: live[k], error: errors[k], onChange: (e: { target: { value: string } }) => setLive({ ...live, [k]: e.target.value }) });

  return (
    <div className="manage-grid">
      <section className="panel stack" aria-labelledby="m-status">
        <h2 id="m-status" className="heading-3">
          Status
        </h2>
        {p.statusOptions.length ? (
          <div className="row">
            <SelectField label="Move to" name="status" placeholder="Choose a status" options={p.statusOptions} value={status} onChange={(e) => setStatus(e.target.value)} />
            <Button size="sm" disabled={!status} loading={s1.pending} onClick={() => s1.go(() => setListingStatus(p.id, status as never), () => setStatus(''))}>
              Update status
            </Button>
          </div>
        ) : (
          <p className="body-s muted">No manual moves from here. Sales and leases close from the deal.</p>
        )}
      </section>

      <section className="panel stack" aria-labelledby="m-price">
        <h2 id="m-price" className="heading-3">
          {p.purpose === 'rent' ? 'Rent' : 'Price'}
        </h2>
        <div className="row">
          <TextField label={p.purpose === 'rent' ? 'Monthly rent ($)' : 'Asking price ($)'} mono inputMode="numeric" value={price} error={errors.price} onChange={(e) => setPrice(e.target.value)} />
          <Button size="sm" loading={s2.pending} onClick={() => s2.go(() => setListingPrice(p.id, price), () => setErrors({}), setErrors)}>
            Change price
          </Button>
        </div>
        <p className="caption muted">Price changes go live straight away and are added to the price history.</p>
      </section>

      <section className="panel stack span-all" aria-labelledby="m-edit">
        <h2 id="m-edit" className="heading-3">
          Edit the live listing
        </h2>
        {p.pendingRevision ? <p className="review-note body-s">An edit is waiting for review. The live listing stays as it is until it’s approved.</p> : null}
        {p.reviewNote ? <p className="body-s muted">{p.reviewNote}</p> : null}
        <div className="grid-12">
          <TextField className="span-4" label="Bedrooms" mono inputMode="numeric" {...bind('beds')} />
          <TextField className="span-4" label="Bathrooms" mono inputMode="decimal" {...bind('baths')} />
          <TextField className="span-4" label="Living space (sq ft)" mono inputMode="numeric" {...bind('sqft')} />
        </div>
        <TextField label="Description" multiline rows={6} {...bind('description')} />
        <TextField label="Showing instructions" multiline rows={2} {...bind('showingInstructions')} />
        <div className="row">
          <Button variant="secondary" loading={s3.pending} disabled={p.pendingRevision} onClick={() => s3.go(() => saveLiveEdit(p.id, live), () => setErrors({}), setErrors)}>
            Save changes
          </Button>
        </div>
      </section>

      <section className="panel stack span-all" aria-labelledby="m-deal">
        <h2 id="m-deal" className="heading-3">
          Open a deal
        </h2>
        <div className="grid-12">
          <SelectField className="span-6" label="Client" name="client" placeholder="Choose a client file" options={p.clients} value={dealClient} onChange={(e) => setDealClient(e.target.value)} error={errors.clientId} />
          <div className="span-6">
            <RadioGroup
              legend="They are"
              name="side"
              value={side}
              onChange={setSide}
              options={p.purpose === 'rent' ? [{ value: 'tenant', label: 'Renting' }] : [{ value: 'buyer', label: 'Buying' }]}
            />
          </div>
        </div>
        <div className="row">
          <Button
            icon="pipeline"
            disabled={!dealClient}
            loading={s4.pending}
            onClick={() => s4.go(() => createDealAction({ listingId: p.id, clientId: dealClient, side }), (r) => r.ok && r.data && s4.router.push(`/portal/deals/${r.data}`), setErrors)}
          >
            Open deal
          </Button>
          <Button variant="ghost" href="/portal/clients/new">
            New client file
          </Button>
        </div>
      </section>
    </div>
  );
}
