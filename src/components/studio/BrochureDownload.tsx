'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { Brochure, exportPng, type StudioData } from './Artboards';

/** "Download brochure" on the property page: the 1080×1350 PNG, made in the browser from the listing's own data. */
export function BrochureDownload({ data, name }: { data: StudioData; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button
        variant="ghost"
        icon="image"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await exportPng(ref.current!.firstElementChild as HTMLElement, `${name}-brochure.png`);
          } catch (e) {
            console.error(e);
            toast({ message: 'The brochure couldn’t be made. Try again.', tone: 'danger' });
          } finally {
            setBusy(false);
          }
        }}
      >
        Download brochure
      </Button>
      <div ref={ref} className="doc-render" aria-hidden inert>
        <Brochure d={data} />
      </div>
    </>
  );
}
