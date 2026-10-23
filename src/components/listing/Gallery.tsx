'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mark } from '@/components/ui/Logo';
import type { PhotoView } from '@/lib/listing-view';

/** 3:2 gallery: swipes on touch (scroll snap), thumbnails on desktop, full-screen viewer with arrow keys. */
export function Gallery({ photos, postalCode, title }: { photos: PhotoView[]; postalCode: string | null; title: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const caption = (p: PhotoView) => ['In-game photo', postalCode ? `Postal ${postalCode}` : null, p.caption].filter(Boolean).join(' · ');

  const go = useCallback(
    (i: number) => {
      const n = (i + photos.length) % photos.length;
      setIndex(n);
      const el = track.current?.children[n] as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    },
    [photos.length],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  if (!photos.length) {
    return (
      <div className="gallery-ph">
        <Mark size={56} decorative />
        <span>Photos coming soon</span>
      </div>
    );
  }

  const current = photos[index]!;
  return (
    <section className="gallery" aria-label={`Photos of ${title}`}>
      <div
        className="gallery-track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index && i >= 0 && i < photos.length) setIndex(i);
        }}
      >
        {photos.map((p, i) => (
          <figure key={p.id} className="gallery-slide">
            <button type="button" className="gallery-open" onClick={() => { setIndex(i); setOpen(true); }} aria-label={`Open photo ${i + 1} of ${photos.length} full screen`}>
              <Image src={p.src} alt={p.alt} fill priority={i === 0} sizes="(max-width: 900px) 100vw, 66vw" className="photo-grade" />
            </button>
          </figure>
        ))}
      </div>
      <div className="gallery-bar">
        <p className="caption muted">{caption(current)}</p>
        <span className="id muted" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
      </div>
      {photos.length > 1 ? (
        <div className="gallery-thumbs" role="list">
          {photos.map((p, i) => (
            <button key={p.id} type="button" role="listitem" className="gallery-thumb" aria-current={i === index ? 'true' : undefined} aria-label={`Show photo ${i + 1}`} onClick={() => go(i)}>
              <Image src={p.src} alt="" fill sizes="120px" className="photo-grade" />
            </button>
          ))}
        </div>
      ) : null}
      <dialog ref={dialog} className="lightbox" aria-label="Photo viewer" onClose={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <div className="lightbox-frame">
          <Image src={current.src} alt={current.alt} fill sizes="100vw" className="lightbox-img photo-grade" />
        </div>
        <div className="lightbox-bar">
          <p className="caption">{caption(current)}</p>
          <div className="row">
            <button type="button" className="jr-btn jr-btn--secondary jr-btn--sm" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}>
              Previous
            </button>
            <span className="id">
              {index + 1} / {photos.length}
            </span>
            <button type="button" className="jr-btn jr-btn--secondary jr-btn--sm" onClick={() => setIndex((i) => (i + 1) % photos.length)}>
              Next
            </button>
            <button type="button" className="jr-btn jr-btn--primary jr-btn--sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
