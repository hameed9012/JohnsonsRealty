'use client';

import Image from 'next/image';
import { useRef, useState, useTransition } from 'react';
import { Button } from './Button';
import { Mark } from './Logo';
import { useToast } from './Toaster';
import { ACCEPT, dimensions, MAX_BYTES, send, toUploaded, type UploadTarget } from './Uploader';

export interface ImageFieldProps {
  label: string;
  hint?: string;
  current: string | null;
  /** CSS aspect ratio for the preview, like "21 / 9". */
  ratio?: string;
  getTarget: () => Promise<{ ok: true; target: UploadTarget } | { ok: false; message: string }>;
  save: (uploaded: unknown) => Promise<{ ok: boolean; message: string; storageId?: string }>;
  clear: () => Promise<{ ok: boolean; message: string }>;
}

/** One image (hero, area photo, agent photo): preview, replace with progress, remove. */
export function ImageField({ label, hint, current, ratio = '3 / 2', getTarget, save, clear }: ImageFieldProps) {
  const [src, setSrc] = useState(current);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError('Upload a JPG, PNG or WebP image.');
    if (file.size > MAX_BYTES) return setError('Images must be under 10 MB.');
    const t = await getTarget();
    if (!t.ok) return setError(t.message);
    try {
      setProgress(0);
      const dims = await dimensions(file);
      const body = await send(t.target, file, setProgress);
      const r = await save(toUploaded(t.target, body, dims));
      if (!r.ok) setError(r.message);
      else {
        setSrc(r.storageId ?? null);
        toast({ message: r.message, tone: 'success' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload didn’t go through.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="image-field stack">
      <span className="jr-field-label">{label}</span>
      <div className="image-field-preview" style={{ aspectRatio: ratio }}>
        {src ? <Image src={src} alt="" fill sizes="480px" className="photo-grade" /> : <Mark size={32} decorative />}
      </div>
      {hint ? <p className="jr-field-hint">{hint}</p> : null}
      {progress !== null ? <progress max={100} value={progress} aria-label={`Uploading ${label}`} /> : null}
      {error ? (
        <p className="jr-field-hint" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      <div className="row">
        <Button size="sm" variant="secondary" icon="image" onClick={() => input.current?.click()} loading={progress !== null}>
          {src ? 'Replace image' : 'Upload image'}
        </Button>
        {src ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await clear();
                if (r.ok) setSrc(null);
                toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
              })
            }
          >
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label={`Choose ${label}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
