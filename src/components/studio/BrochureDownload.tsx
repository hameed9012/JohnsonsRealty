'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toaster';
import { Brochure, exportPng, type StudioData } from './Artboards';

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/**
 * "Download brochure" on the property page: the 1080×1350 PNG, made in the browser from the listing's own data.
 * The brochure (and its full-size photos) is only rendered once someone asks for it.
 */
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
            await frame();
            const board = ref.current!.firstElementChild as HTMLElement;
            await Promise.all([...board.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
            await exportPng(board, `${name}-brochure.png`);
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
      {busy ? (
        <div ref={ref} className="doc-render" aria-hidden inert>
          <Brochure d={data} />
        </div>
      ) : null}
    </>
  );
}
