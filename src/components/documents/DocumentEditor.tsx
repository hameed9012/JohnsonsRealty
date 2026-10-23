'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Dialog';
import { SelectField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import type { DocStatus } from '@/forms/status';
import type { DocData } from '@/forms/types';
import type { FormType } from '@/lib/refs';
import { deleteDraftAction, fillDocumentAction, saveDocumentAction, setDocumentStatusAction, shareDocumentAction } from '@/server/actions/documents';
import type { OpResult } from '@/server/actions/ops';
import { DocSheet, type DocSheetProps, type Signature } from './DocSheet';

type Option = { value: string; label: string };

export interface DocumentEditorProps extends Omit<DocSheetProps, 'editable' | 'onChange' | 'onSign' | 'errors' | 'hideInternal'> {
  id: string;
  shared: boolean;
  canReopen: boolean;
  dealId: string | null;
  picks: { sellerClientId: string; buyerClientId: string; listingId: string };
  clientOptions: Option[];
  listingOptions: Option[];
  partyLabels: { seller: string; buyer: string };
}

/** Makes a PNG of the print copy at its on-screen size (860px wide), doubled for sharpness. */
async function saveImage(node: HTMLElement, name: string) {
  const { toPng } = await import('html-to-image');
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true, width: node.offsetWidth, height: node.offsetHeight });
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.png`;
  a.click();
}

export function DocumentEditor(props: DocumentEditorProps) {
  const { id, type, docNo, status, shared, canReopen, dealId, picks, clientOptions, listingOptions, partyLabels } = props;
  const [data, setData] = useState<DocData>(props.data);
  const [sigs, setSigs] = useState<Record<string, Signature>>(props.signatures);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fillOpen, setFillOpen] = useState(false);
  const [fill, setFill] = useState(picks);
  const [pending, start] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [isShared, setShared] = useState(shared);
  const printRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const router = useRouter();
  const locked = status === 'signed';

  const signatureList = () => Object.entries(sigs).map(([party, s]) => ({ party, typedName: s.typedName.trim(), signedOn: s.signedOn }));

  const report = (r: OpResult<unknown>) => {
    setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
    if (r.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
    return r.ok;
  };

  const save = async () => {
    const ok = report(await saveDocumentAction(id, data, signatureList()));
    if (ok) setDirty(false);
    return ok;
  };

  const act = (fn: () => Promise<OpResult<unknown>>, saveFirst = false) =>
    start(async () => {
      if (saveFirst && dirty && !locked && !(await save())) return;
      if (report(await fn())) router.refresh();
    });

  const change = (patch: DocData) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const sign = (party: string, patch: Partial<Signature>) => {
    setSigs((s) => ({ ...s, [party]: { typedName: '', signedOn: '', ...s[party], ...patch } }));
    setDirty(true);
  };

  const runFill = () =>
    start(async () => {
      const r = await fillDocumentAction(id, data, { dealId, sellerClientId: fill.sellerClientId, buyerClientId: fill.buyerClientId, listingId: fill.listingId });
      if (report(r) && r.ok && r.data) {
        setData(r.data);
        setDirty(true);
        setFillOpen(false);
      }
    });

  const exportImage = () =>
    start(async () => {
      setExporting(true);
      try {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await saveImage(printRef.current!.firstElementChild as HTMLElement, docNo);
      } catch (e) {
        console.error(e);
        toast({ message: 'The image couldn’t be made. Try Print instead.', tone: 'danger' });
      } finally {
        setExporting(false);
      }
    });

  const sheet = { ...props, data, signatures: sigs };

  return (
    <div className="stack-lg">
      <div className="doc-toolbar no-print" role="toolbar" aria-label="Document actions">
        {!locked ? (
          <Button loading={pending} onClick={() => start(async () => void (await save()))} icon="check">
            {dirty ? 'Save draft' : 'Saved'}
          </Button>
        ) : null}
        {!locked ? (
          <Button variant="secondary" icon="users" onClick={() => setFillOpen(true)}>
            Fill from client file
          </Button>
        ) : null}
        {status === 'draft' ? (
          <Button variant="secondary" icon="share" disabled={pending} onClick={() => act(() => setDocumentStatusAction(id, 'sent'), true)}>
            Mark as sent
          </Button>
        ) : null}
        {!locked ? (
          <Button variant="secondary" icon="stamp" disabled={pending} onClick={() => act(() => setDocumentStatusAction(id, 'signed'), true)}>
            Mark as signed
          </Button>
        ) : canReopen ? (
          <Button variant="ghost" disabled={pending} onClick={() => act(() => setDocumentStatusAction(id, 'draft'))}>
            Reopen to edit
          </Button>
        ) : null}
        <Button variant="secondary" icon="image" loading={exporting} onClick={exportImage}>
          Save as image
        </Button>
        <Button variant="secondary" icon="document" onClick={() => window.print()}>
          Print or save as PDF
        </Button>
        {status === 'draft' ? (
          <Button variant="ghost" disabled={pending} onClick={() => confirm('Delete this draft? This can’t be undone.') && act(() => deleteDraftAction(id))}>
            Delete draft
          </Button>
        ) : null}
      </div>
      <div className="no-print">
        <Toggle label="Share with the client" hint="Shows on their account under their deal, without brokerage-only sections." checked={isShared}
          disabled={pending}
          onChange={(e) => {
            const on = e.target.checked;
            setShared(on);
            start(async () => {
              if (dirty && !locked && !(await save())) return setShared(!on);
              const r = await shareDocumentAction(id, on);
              if (!report(r)) setShared(!on);
              else router.refresh();
            });
          }}
        />
      </div>

      <div className="doc-screen">
        <DocSheet {...sheet} editable={!locked} errors={errors} onChange={change} onSign={sign} />
      </div>
      {/* The clean copy for print and image export. Laid out off-screen so html-to-image can measure it. */}
      <div ref={printRef} className="doc-render" aria-hidden inert>
        <DocSheet {...sheet} />
      </div>

      <Modal
        open={fillOpen}
        onClose={() => setFillOpen(false)}
        title="Fill from client file"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFillOpen(false)}>
              Cancel
            </Button>
            <Button loading={pending} onClick={runFill}>
              Fill the form
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="body-s muted">Fields fill from the client files and listing. Anything the files don’t have keeps what you typed.{dealId ? ' This document is on a deal, so its parties are used unless you choose others.' : ''}</p>
          <SelectField label={partyLabels.seller} placeholder={dealId ? 'From the deal' : 'None'} options={clientOptions} value={fill.sellerClientId} onChange={(e) => setFill({ ...fill, sellerClientId: e.target.value })} />
          <SelectField label={partyLabels.buyer} placeholder={dealId ? 'From the deal' : 'None'} options={clientOptions} value={fill.buyerClientId} onChange={(e) => setFill({ ...fill, buyerClientId: e.target.value })} />
          <SelectField label="Listing" placeholder={dealId ? 'From the deal' : 'None'} options={listingOptions} value={fill.listingId} onChange={(e) => setFill({ ...fill, listingId: e.target.value })} />
        </div>
      </Modal>
      <span className="sr-only" aria-live="polite">
        {type ? (dirty ? 'Unsaved changes' : '') : ''}
      </span>
    </div>
  );
}
