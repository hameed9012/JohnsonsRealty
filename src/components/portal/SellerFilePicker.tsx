'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { startFromSellerFileAction } from '@/server/actions/legacy-import';

export interface SellerFileOption {
  key: string;
  seller: string;
  address: string;
  price: string;
  kind: string;
}

/** One button per property in the seller files that isn't listed yet. */
export function SellerFilePicker({ options }: { options: SellerFileOption[] }) {
  const [busy, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const toast = useToast();
  return (
    <ul className="saved-list">
      {options.map((o) => (
        <li key={o.key}>
          <span className="stack">
            <b>{o.address}</b>
            <span className="body-s muted">
              {[o.seller, o.kind, o.price].filter(Boolean).join(' · ')}
            </span>
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={busy && which === o.key}
            disabled={busy}
            onClick={() => {
              setWhich(o.key);
              start(async () => {
                // On success the action opens the new listing; it only returns here with a problem.
                const r = await startFromSellerFileAction(o.key);
                if (r && !r.ok) toast({ message: r.message, tone: 'danger' });
              });
            }}
          >
            Use this<span className="sr-only"> for {o.address}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
