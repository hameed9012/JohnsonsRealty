'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { runLegacyImportAction } from '@/server/actions/legacy-import';

/** The import button, with the sold listing's price and date (prefilled from the file, editable). */
export function ImportRunner({ remaining, sale }: { remaining: number; sale: { label: string; price: number | null; soldOn: string | null } | null }) {
  const [price, setPrice] = useState(sale?.price ? String(sale.price) : '');
  const [soldOn, setSoldOn] = useState(sale?.soldOn ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  if (!remaining) return <p className="body muted">Every seller file has been imported.</p>;
  return (
    <section className="panel stack" aria-labelledby="imp-run">
      <h2 className="panel-title" id="imp-run">
        Import
      </h2>
      {sale ? (
        <div className="stack">
          <p className="body">{sale.label} sold. Confirm the sale record:</p>
          <div className="row">
            <TextField label="Sale price" name="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.price} />
            <TextField label="Sale date" name="soldOn" type="date" value={soldOn} onChange={(e) => setSoldOn(e.target.value)} error={errors.soldOn} />
          </div>
        </div>
      ) : null}
      <div className="row">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await runLegacyImportAction({ price: price.replace(/[$,\s]/g, ''), soldOn });
              setErrors(r.fieldErrors ?? {});
              toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
              if (r.ok) router.refresh();
            })
          }
        >
          Import {remaining} seller files
        </Button>
        <span className="body-s muted">No review queue and no Discord posts. Listings without photos stay off the public site.</span>
      </div>
    </section>
  );
}
