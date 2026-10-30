'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { importKitPhotoAction, importLegacySellerAction } from '@/server/actions/legacy-import';

export interface ImportPending {
  key: string;
  label: string;
}

export interface ImportPhotoJob {
  key: string;
  label: string;
  total: number;
  have: number;
}

/**
 * Imports the sellers one request at a time, so a problem with one never stops the rest, then uploads kit
 * photos one at a time. Every problem is listed; running it again picks up what's left.
 */
export function ImportRunner({ pending, photoJobs, sale }: { pending: ImportPending[]; photoJobs: ImportPhotoJob[]; sale: { key: string; label: string; price: number | null; soldOn: string | null } | null }) {
  const [price, setPrice] = useState(sale?.price ? String(sale.price) : '');
  const [soldOn, setSoldOn] = useState(sale?.soldOn ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const runSellers = () =>
    start(async () => {
      const found: string[] = [];
      let done = 0;
      for (const [i, p] of pending.entries()) {
        setProgress(`Importing ${i + 1} of ${pending.length}: ${p.label}…`);
        try {
          const r = await importLegacySellerAction(p.key, p.key === sale?.key ? { price: price.replace(/[$,\s]/g, ''), soldOn } : undefined);
          if (r.fieldErrors) setErrors(r.fieldErrors);
          if (r.ok) done++;
          else found.push(r.message);
        } catch (e) {
          found.push(`${p.label}: ${e instanceof Error ? e.message : 'the request failed'}.`);
        }
      }
      setProgress('');
      setProblems(found);
      toast({ message: found.length ? `Imported ${done} of ${pending.length}. Some need attention.` : `Imported ${done} seller ${done === 1 ? 'file' : 'files'}.`, tone: found.length ? 'danger' : 'success' });
      router.refresh();
    });

  const runPhotos = (job: ImportPhotoJob) =>
    start(async () => {
      const found: string[] = [];
      for (let i = 0; i < job.total; i++) {
        setProgress(`Uploading photo ${i + 1} of ${job.total} for ${job.label}…`);
        try {
          const r = await importKitPhotoAction(job.key, i);
          if (!r.ok) {
            found.push(`Photo ${i + 1}: ${r.message}`);
            // The same problem (usually the Cloudinary settings) would repeat for every photo.
            if (i === 0 || found.length >= 2) break;
          }
        } catch (e) {
          found.push(`Photo ${i + 1}: ${e instanceof Error ? e.message : 'the request failed'}`);
          break;
        }
      }
      setProgress('');
      setProblems(found);
      toast({ message: found.length ? `Some photos for ${job.label} didn’t upload.` : `Photos added to ${job.label}.`, tone: found.length ? 'danger' : 'success' });
      router.refresh();
    });

  return (
    <section className="panel stack" aria-labelledby="imp-run">
      <h2 className="panel-title" id="imp-run">
        Import
      </h2>
      {problems.length ? (
        <ul className="stack" role="alert">
          {problems.map((p) => (
            <li key={p} className="body">
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      {progress ? (
        <p className="body" role="status">
          {progress}
        </p>
      ) : null}

      {pending.length ? (
        <div className="stack">
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
            <Button loading={busy} onClick={runSellers}>
              Import {pending.length} seller {pending.length === 1 ? 'file' : 'files'}
            </Button>
            <span className="body-s muted">One at a time; a problem with one never stops the rest. No review queue and no Discord posts.</span>
          </div>
        </div>
      ) : (
        <p className="body muted">Every seller file has been imported.</p>
      )}

      {photoJobs.map((j) => (
        <div key={j.key} className="row">
          <Button variant="secondary" loading={busy} onClick={() => runPhotos(j)}>
            Upload {j.label}’s photos
          </Button>
          <span className="body-s muted">
            {j.have} of {j.total} on the listing. It goes on the public site once it has 3.
          </span>
        </div>
      ))}
    </section>
  );
}
