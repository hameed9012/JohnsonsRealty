'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { PropertyView } from '@/components/listing/PropertyView';
import { ReferenceReceipt } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ListingCard } from '@/components/ui/ListingCard';
import { Modal } from '@/components/ui/Dialog';
import { StatusPill } from '@/components/ui/StatusStamp';
import { useToast } from '@/components/ui/Toaster';
import { Uploader, type UploaderPhoto } from '@/components/ui/Uploader';
import type { ChecklistItem } from '@/lib/listing-checklist';
import { statusKey, type ListingStatus } from '@/lib/listing-status';
import { OWNER_STEPS, STEPS } from '@/lib/schemas/listing';
import {
  deletePhoto,
  generateSellerAction,
  getUploadTarget,
  registerPhoto,
  saveListingStep,
  savePhotos,
  submitListing,
  withdrawListingAction,
} from '@/server/actions/listings';
import { PropertyFields } from './PropertyFields';
import { OwnerFields, SellerFields } from './SellerFields';
import { TermsFields } from './TermsFields';
import type { EditorData, EditorOptions, OwnerValues, SellerValues } from './types';
import { statusText, useStepForm } from './useStepForm';

type Step = 'property' | 'terms' | 'photos' | 'seller' | 'owner' | 'review';

export function Wizard({ data, options, confidential }: { data: EditorData; options: EditorOptions; confidential: boolean }) {
  const owner = data.source === 'owner_submitted';
  const steps = owner ? OWNER_STEPS : STEPS;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const step = (steps.find((s) => s.key === params.get('step'))?.key ?? 'property') as Step;
  const [receipt, setReceipt] = useState<{ refNo: string; round: number } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [missing, setMissing] = useState<ChecklistItem[] | null>(null);

  const property = useStepForm(data.property, useCallback((v) => saveListingStep(data.id, 'property', v), [data.id]));
  const terms = useStepForm(data.terms, useCallback((v) => saveListingStep(data.id, 'terms', v), [data.id]));
  const seller = useStepForm<SellerValues>(
    data.seller ?? ({} as SellerValues),
    useCallback(
      (v: SellerValues) => {
        const { clientId, ...rest } = v;
        return saveListingStep(data.id, 'seller', { ...rest, clientId: clientId || null });
      },
      [data.id],
    ),
  );
  const ownerForm = useStepForm<OwnerValues>(
    data.owner ?? ({} as OwnerValues),
    useCallback((v: OwnerValues) => saveListingStep(data.id, 'owner', v), [data.id]),
    { initiallyDirty: owner && data.checklist.some((c) => c.step === 'owner') },
  );
  const photos = useStepForm<{ photos: UploaderPhoto[] }>(
    { photos: data.photos },
    useCallback(
      (v: { photos: UploaderPhoto[] }) =>
        savePhotos(
          data.id,
          { order: v.photos.map((p) => p.id), coverId: v.photos.find((p) => p.isCover)?.id ?? null },
          v.photos.map((p) => ({ id: p.id, alt: p.alt, caption: p.caption })),
        ),
      [data.id],
    ),
  );

  const forms = { property, terms, photos, seller, owner: ownerForm } as const;
  const current = step === 'review' ? null : forms[step];
  const status = current?.status ?? 'idle';

  async function go(to: Step) {
    if (current && !(await current.flush())) {
      toast({ message: 'Fix the highlighted fields to continue.', tone: 'danger' });
      return;
    }
    const q = new URLSearchParams(params);
    q.set('step', to);
    router.replace(`${pathname}?${q}`, { scroll: true });
    router.refresh();
  }

  const idx = steps.findIndex((s) => s.key === step);
  const next = steps[idx + 1]?.key as Step | undefined;
  const prev = steps[idx - 1]?.key as Step | undefined;
  const checklist = missing ?? data.checklist;
  const stepsWithIssues = new Set(checklist.map((c) => c.step));

  if (receipt) {
    return (
      <div className="stack-lg">
        <ReferenceReceipt
          eyebrow={receipt.round > 1 ? 'Resubmitted' : 'Submitted for review'}
          title={owner ? 'Your listing is with our team' : 'Listing submitted for review'}
          reference={receipt.refNo}
          text={owner ? 'The Owner reviews every listing. We’ll notify you here when it’s approved or if anything needs changing.' : 'The Owner has been notified. You’ll get a notification when it’s decided.'}
          action={<Button href={owner ? '/account/listings' : '/portal/listings'}>{owner ? 'Go to my listings' : 'Go to listings'}</Button>}
        />
      </div>
    );
  }

  if (!data.editable) {
    return (
      <div className="stack-lg">
        <div className="row">
          <StatusPill status={statusKey(data.status as ListingStatus)} />
          <span className="id muted">{data.refNo}</span>
        </div>
        <p className="body">{data.status === 'pending_review' ? 'This listing is waiting for review, so it can’t be edited right now.' : 'This listing can’t be edited here.'}</p>
        <div data-theme="light" className="preview-frame">
          <PropertyView view={data.preview} preview headingLevel={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="wizard">
      <nav aria-label="Listing steps">
        <ol className="wizard-steps">
          {steps.map((s) => (
            <li key={s.key}>
              <button type="button" aria-current={s.key === step ? 'step' : undefined} onClick={() => go(s.key as Step)}>
                {s.label}
                {s.key !== 'review' && !stepsWithIssues.has(s.key as ChecklistItem['step']) ? (
                  <Icon name="check" size={16} label="Complete" className="done" />
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="jr-min0">
        {data.lastReview?.decision === 'changes_requested' && data.status === 'changes_requested' ? (
          <div className="review-note stack" role="note">
            <span className="label">Changes requested · round {data.lastReview.round}</span>
            <p className="body">{data.lastReview.notes}</p>
          </div>
        ) : null}

        {data.live ? (
          <div className="review-note stack" role="note">
            <span className="label">Live listing</span>
            <p className="body">Changes save straight to the site, and the seller file follows. A new price goes into the price history, and a cut is announced in Discord.</p>
          </div>
        ) : null}

        <h2 className="heading-1" style={{ margin: 'var(--space-6) 0' }}>
          {steps[idx]!.label}
        </h2>

        {step === 'property' ? <PropertyFields form={property} options={options} simple={owner} /> : null}
        {step === 'terms' ? <TermsFields form={terms} purpose={property.values.purpose} type={property.values.type} simple={owner} /> : null}
        {step === 'photos' ? (
          <Uploader
            photos={photos.values.photos}
            getTarget={getUploadTarget}
            register={async (u) => {
              const r = await registerPhoto(data.id, u);
              return r.ok && 'photo' in r ? { ok: true, photo: r.photo } : { ok: false, message: r.message };
            }}
            onChange={(ps) => photos.set('photos', ps)}
            onRemove={async (id) => {
              const r = await deletePhoto(data.id, id);
              if (!r.ok) toast({ message: r.message ?? 'Couldn’t remove that photo.', tone: 'danger' });
              return r.ok;
            }}
          />
        ) : null}
        {step === 'seller' && !owner ? (
          <SellerFields
            form={seller}
            options={options}
            type={property.values.type}
            confidential={confidential}
            generate={async (again) => {
              // The generator reads the saved property details, so save those first.
              await property.flush();
              await terms.flush();
              const r = await generateSellerAction(data.id, again);
              toast({ message: r.message ?? (r.ok ? 'Seller generated' : 'Couldn’t generate a seller.'), tone: r.ok ? 'success' : 'danger' });
              return r.ok ? (r.data?.values ?? null) : null;
            }}
          />
        ) : null}
        {step === 'owner' && owner ? <OwnerFields form={ownerForm} account={options.account} /> : null}

        {step === 'review' ? (
          <div className="stack-lg">
            {checklist.length ? (
              <section className="stack" aria-labelledby="missing-h">
                <h3 id="missing-h" className="heading-2">
                  Still to do
                </h3>
                <ul className="checklist">
                  {checklist.map((c, i) => (
                    <li key={i}>
                      {c.message}
                      <Button size="sm" variant="ghost" onClick={() => go(c.step as Step)}>
                        Go to {steps.find((s) => s.key === c.step)?.label.toLowerCase()}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="body">{data.live ? 'Everything’s saved. Check the preview.' : 'Everything’s in place. Check the preview, then submit it for review.'}</p>
            )}
            <section className="stack">
              <h3 className="heading-2">Listing card</h3>
              <div data-theme="light" className="preview-frame" style={{ maxWidth: '420px' }}>
                <ListingCard
                  address={data.preview.title}
                  area={data.preview.areaName ?? undefined}
                  price={data.preview.price ?? 0}
                  priceKind={data.preview.purpose === 'rent' ? 'rent' : 'sale'}
                  status={data.preview.purpose === 'rent' ? 'for-lease' : 'just-listed'}
                  photo={data.preview.cover?.src}
                  photoAlt={data.preview.cover?.alt}
                  facts={data.preview.cardFacts}
                  ownerListed={owner}
                />
              </div>
            </section>
            <section className="stack">
              <h3 className="heading-2">Property page</h3>
              <div data-theme="light" className="preview-frame">
                <PropertyView view={{ ...data.preview, status: data.preview.purpose === 'rent' ? 'for-lease' : 'just-listed' }} preview headingLevel={2} />
              </div>
            </section>
          </div>
        ) : null}

        <div className="wizard-foot">
          <span className="wizard-status" data-state={status} role="status" aria-live="polite">
            {data.live && status === 'saved' ? 'Saved. Live on the site.' : statusText(status)}
          </span>
          <div className="row">
            {data.status !== 'draft' && data.status !== 'withdrawn' ? (
              <Button variant="ghost" onClick={() => setWithdrawOpen(true)}>
                Withdraw listing
              </Button>
            ) : null}
            {prev ? (
              <Button variant="secondary" onClick={() => go(prev)}>
                Back
              </Button>
            ) : null}
            {next ? (
              <Button onClick={() => go(next)} iconRight="arrow-right">
                Save and continue
              </Button>
            ) : data.live ? (
              <Button
                onClick={async () => {
                  if (current && !(await current.flush())) return;
                  router.push(`/portal/listings/${data.id}`);
                }}
              >
                Done
              </Button>
            ) : (
              <Button
                withKey
                loading={submitting}
                disabled={checklist.length > 0}
                onClick={() =>
                  startSubmit(async () => {
                    const r = await submitListing(data.id);
                    if (r.ok && r.data) {
                      setReceipt(r.data);
                      toast({ message: 'Submitted for review', tone: 'success' });
                    } else {
                      if ('checklist' in r && r.checklist) setMissing(r.checklist);
                      toast({ message: r.message ?? 'Couldn’t submit.', tone: 'danger' });
                    }
                  })
                }
              >
                Submit for review
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw this listing?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const r = await withdrawListingAction(data.id);
                setWithdrawOpen(false);
                toast({ message: r.message ?? '', tone: r.ok ? 'success' : 'danger' });
                if (r.ok) router.push(owner ? '/account/listings' : '/portal/listings');
              }}
            >
              Withdraw listing
            </Button>
          </>
        }
      >
        <p className="body">It comes off the review queue and won’t go public. You can resubmit it later.</p>
      </Modal>
    </div>
  );
}
