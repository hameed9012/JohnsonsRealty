'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/controls';
import { FilterChip } from '@/components/ui/FilterChip';
import { SelectField, TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { CHIRP_LIMIT, draftChirp, type ChirpKind } from '@/lib/chirper';
import { Artboard, exportPng, FORMATS, STAMPS, type Format, type Stamp, type StudioData } from './Artboards';

type Option = { value: string; label: string };

export interface StudioEditorProps {
  listingId: string;
  listingOptions: Option[];
  initial: StudioData;
  photos: string[];
  me: StudioData['agent'];
  figures: { value: string; label: string }[];
  chirp: { kind: ChirpKind; area: string; facts: string[]; url: string } | null;
}

/** Scales a fixed-size artboard to the stage width, keeping its real layout for export. */
function Stage({ format, d, figures, boardRef }: { format: Format; d: StudioData; figures: StudioEditorProps['figures']; boardRef: React.RefObject<HTMLDivElement | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const f = FORMATS[format];
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.2, el.clientWidth / f.w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [f.w]);
  return (
    <div ref={wrap} className="studio-scaler" style={{ height: f.h * scale }}>
      <div ref={boardRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: f.w, height: f.h }}>
        <Artboard format={format} d={d} figures={figures} />
      </div>
    </div>
  );
}

export function StudioEditor({ listingId, listingOptions, initial, photos, me, figures, chirp }: StudioEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const [format, setFormat] = useState<Format>(listingId ? 'brochure' : 'card-back');
  const [d, setD] = useState<StudioData>(initial);
  const [card, setCard] = useState(me);
  const [pending, start] = useTransition();
  const [chirpKind, setChirpKind] = useState<ChirpKind>(chirp?.kind ?? 'listed');
  const [when, setWhen] = useState('');
  const draft = useMemo(
    () =>
      chirp
        ? draftChirp({ kind: chirpKind, when, address: d.address, area: chirp.area, facts: chirp.facts, price: d.showPrice ? d.price : null, blurb: d.blurb, url: chirp.url, agentHandle: d.agent.chirper || null, brokerageHandle: d.brokerage.chirper || null })
        : '',
    [chirp, chirpKind, when, d],
  );
  const [chirpText, setChirpText] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isCard = format === 'card-front' || format === 'card-back';
  const shown: StudioData = isCard ? { ...d, agent: card } : d;
  const set = (patch: Partial<StudioData>) => setD((x) => ({ ...x, ...patch }));
  const setStat = (i: number, patch: Partial<StudioData['stats'][number]>) => {
    const stats = [0, 1, 2, 3].map((n) => d.stats[n] ?? { value: '', label: '' });
    stats[i] = { ...stats[i]!, ...patch };
    set({ stats });
  };
  const togglePhoto = (src: string) => set({ photos: d.photos.includes(src) ? d.photos.filter((p) => p !== src) : [...d.photos, src].slice(0, 3) });
  const formats = (Object.keys(FORMATS) as Format[]).filter((f) => listingId || f === 'banner' || f === 'card-front' || f === 'card-back');

  const save = () =>
    start(async () => {
      try {
        const board = boardRef.current!.firstElementChild as HTMLElement;
        await exportPng(board, `${isCard ? card.name || 'business-card' : d.address || 'johnsons-realty'}-${FORMATS[format].label}.png`);
      } catch (e) {
        console.error(e);
        toast({ message: 'The image couldn’t be made. Try a different photo.', tone: 'danger' });
      }
    });

  return (
    <div className="studio">
      <div className="panel stack">
        <SelectField label="Listing" placeholder="No listing (banner and business card)" options={listingOptions} value={listingId} onChange={(e) => router.push(e.target.value ? `/portal/studio?listing=${e.target.value}` : '/portal/studio')} />
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label label--brass">Format</legend>
          <div className="row">
            {formats.map((f) => (
              <FilterChip key={f} selected={format === f} onClick={() => setFormat(f)}>
                {FORMATS[f].label}
              </FilterChip>
            ))}
          </div>
          <p className="body-s muted">Exports at {FORMATS[format].out} pixels.</p>
        </fieldset>

        {isCard ? (
          <div className="stack">
            <span className="label label--brass">Your card</span>
            <TextField label="Name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
            <TextField label="Title" value={card.title} onChange={(e) => setCard({ ...card, title: e.target.value })} />
            <TextField label="Chirper handle" value={card.chirper} onChange={(e) => setCard({ ...card, chirper: e.target.value.replace(/^@/, '') })} />
            <TextField label="Contact line" value={card.contact} onChange={(e) => setCard({ ...card, contact: e.target.value })} />
          </div>
        ) : format === 'banner' ? (
          <p className="body-s muted">The banner shows the brokerage’s figures from the sales ledger. Figures that are zero are left out.</p>
        ) : (
          <>
            <div className="grid-12">
              <SelectField className="span-6" label="Ribbon" options={(Object.keys(STAMPS) as Stamp[]).map((s) => ({ value: s, label: STAMPS[s].label }))} value={d.stamp} onChange={(e) => set({ stamp: e.target.value as Stamp })} />
              <TextField className="span-6" label="Date" type="date" mono value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
            <TextField label="Address" value={d.address} onChange={(e) => set({ address: e.target.value })} />
            <TextField label="Area line" value={d.areaLine} onChange={(e) => set({ areaLine: e.target.value })} />
            <div className="grid-12">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="span-6 row" style={{ flexWrap: 'nowrap' }}>
                  <TextField label={`Figure ${i + 1}`} value={d.stats[i]?.value ?? ''} onChange={(e) => setStat(i, { value: e.target.value })} />
                  <TextField label="Label" value={d.stats[i]?.label ?? ''} onChange={(e) => setStat(i, { label: e.target.value })} />
                </div>
              ))}
            </div>
            <TextField label="One-line description" multiline rows={2} value={d.blurb} onChange={(e) => set({ blurb: e.target.value })} />
            <div className="grid-12">
              <TextField className="span-6" label="Price" mono value={d.price} onChange={(e) => set({ price: e.target.value })} />
              <SelectField className="span-6" label="Represented" options={['The sellers', 'The buyer', 'Both sides', 'The landlord', 'The owner']} value={d.represented} onChange={(e) => set({ represented: e.target.value })} />
            </div>
            <Toggle label="Show the price" checked={d.showPrice} onChange={(e) => set({ showPrice: e.target.checked })} />
            {photos.length ? (
              <div className="stack">
                <span className="jr-field-label">Photos (up to 3, in the order picked)</span>
                <div className="studio-photos">
                  {photos.map((src, i) => {
                    const n = d.photos.indexOf(src);
                    return (
                      <button key={src} type="button" className="studio-photo" aria-pressed={n >= 0} aria-label={`Photo ${i + 1}${n >= 0 ? `, used as ${n === 0 ? 'main photo' : `photo ${n + 1}`}` : ''}`} onClick={() => togglePhoto(src)}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of the listing's own photos */}
                        <img src={src} alt="" />
                        {n >= 0 ? <b>{n + 1}</b> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
        <div className="row">
          <Button icon="image" loading={pending} onClick={save}>
            Save as image
          </Button>
        </div>
      </div>

      <div className="studio-stage stack">
        <Stage format={format} d={shown} figures={figures} boardRef={boardRef} />
        {chirp && !isCard && format !== 'banner' ? (
          <section className="panel stack" aria-labelledby="chirp-h">
            <h2 id="chirp-h" className="heading-3">
              Chirper post
            </h2>
            <div className="grid-12">
              <SelectField
                className="span-6"
                label="Post type"
                options={[
                  { value: 'listed', label: 'Just listed' },
                  { value: 'reduced', label: 'Price reduced' },
                  { value: 'open', label: 'Open house' },
                  { value: 'contract', label: 'Under contract' },
                  { value: 'sold', label: 'Sold' },
                  { value: 'lease', label: 'For lease' },
                  { value: 'leased', label: 'Leased' },
                ]}
                value={chirpKind}
                onChange={(e) => {
                  setChirpKind(e.target.value as ChirpKind);
                  setChirpText(null);
                }}
              />
              {chirpKind === 'open' ? (
                <TextField
                  className="span-6"
                  label="When"
                  placeholder="e.g. Saturday 2–4 pm"
                  value={when}
                  onChange={(e) => {
                    setWhen(e.target.value);
                    setChirpText(null);
                  }}
                />
              ) : null}
            </div>
            <TextField label="Post" multiline rows={7} value={chirpText ?? draft} onChange={(e) => setChirpText(e.target.value)} hint={`${(chirpText ?? draft).length} of ${CHIRP_LIMIT} characters`} error={(chirpText ?? draft).length > CHIRP_LIMIT ? 'Too long for one post.' : undefined} />
            <div className="row">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(chirpText ?? draft);
                    toast({ message: 'Copied. Paste it into Chirper.', tone: 'success' });
                  } catch {
                    toast({ message: 'Couldn’t copy. Select the text and copy it instead.', tone: 'danger' });
                  }
                }}
              >
                Copy post
              </Button>
              {chirpText !== null ? (
                <Button variant="ghost" onClick={() => setChirpText(null)}>
                  Reset to the draft
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
