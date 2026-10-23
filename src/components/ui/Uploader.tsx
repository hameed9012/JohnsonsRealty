'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { Button } from './Button';
import { Icon } from './Icon';

export interface UploaderPhoto {
  id: string;
  storageId: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  isCover: boolean;
}

export type UploadTarget = { provider: 'cloudinary' | 'local'; url: string; fields: Record<string, string> };
export type Uploaded = { storageId: string; width: number; height: number; bytes?: number; format?: string; version?: number; signature?: string };

export interface UploaderProps {
  photos: UploaderPhoto[];
  min?: number;
  getTarget: () => Promise<{ ok: true; target: UploadTarget } | { ok: false; message: string }>;
  register: (u: Uploaded) => Promise<{ ok: true; photo: UploaderPhoto } | { ok: false; message?: string }>;
  onChange: (photos: UploaderPhoto[]) => void;
  onRemove: (id: string) => Promise<boolean>;
  disabled?: boolean;
}

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 10 * 1024 * 1024;

type Pending = { key: string; name: string; progress: number; error?: string };

export function dimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('That file isn’t an image we can read.'));
    img.src = URL.createObjectURL(file);
  });
}

export function send(target: UploadTarget, file: File, onProgress: (p: number) => void): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(target.fields)) fd.append(k, v);
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', target.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error((body.error as { message?: string })?.message ?? (body.error as string) ?? 'The upload didn’t go through. Try again.'));
    };
    xhr.onerror = () => reject(new Error('The upload didn’t go through. Check your connection and try again.'));
    xhr.send(fd);
  });
}

/** Maps a provider's upload response to what the server verifies and stores. */
export function toUploaded(target: UploadTarget, body: Record<string, unknown>, dims: { width: number; height: number }): Uploaded {
  return target.provider === 'cloudinary'
    ? {
        storageId: String(body.public_id),
        width: Number(body.width),
        height: Number(body.height),
        bytes: Number(body.bytes),
        format: String(body.format),
        version: Number(body.version),
        signature: String(body.signature),
      }
    : { storageId: String(body.storageId), width: dims.width, height: dims.height, bytes: Number(body.bytes), format: String(body.format) };
}

export const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 10 * 1024 * 1024;

/** Drag-and-drop photo uploader with progress, drag-to-reorder (plus keyboard buttons), cover choice, alt text and captions. */
export function Uploader({ photos, min = 3, getTarget, register, onChange, onRemove, disabled }: UploaderProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  async function add(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    const t = await getTarget();
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const fail = (error: string) => setPending((xs) => xs.map((x) => (x.key === key ? { ...x, error } : x)));
      setPending((xs) => [...xs, { key, name: file.name, progress: 0 }]);
      if (!t.ok) {
        fail(t.message);
        continue;
      }
      if (!TYPES.includes(file.type)) {
        fail('Upload a JPG, PNG or WebP image.');
        continue;
      }
      if (file.size > MAX) {
        fail('Photos must be under 10 MB.');
        continue;
      }
      try {
        const dims = await dimensions(file);
        const body = await send(t.target, file, (p) => setPending((xs) => xs.map((x) => (x.key === key ? { ...x, progress: p } : x))));
        const uploaded = toUploaded(t.target, body, dims);
        const r = await register(uploaded);
        if (!r.ok) {
          fail(r.message ?? 'That photo couldn’t be saved.');
          continue;
        }
        onChange([...latest.current, r.photo]);
        setPending((xs) => xs.filter((x) => x.key !== key));
      } catch (e) {
        fail(e instanceof Error ? e.message : 'The upload didn’t go through.');
      }
    }
  }

  function move(id: string, to: number) {
    const from = photos.findIndex((p) => p.id === id);
    if (from < 0 || to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [p] = next.splice(from, 1);
    next.splice(to, 0, p!);
    onChange(next);
  }

  const update = (id: string, patch: Partial<UploaderPhoto>) => onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const setCover = (id: string) => onChange(photos.map((p) => ({ ...p, isCover: p.id === id })));
  const short = photos.length < min;

  return (
    <div className="stack">
      <div
        className={cx('uploader-drop', over && 'uploader-drop--over')}
        onDragOver={(e) => {
          if (disabled || !e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (disabled || !e.dataTransfer.files.length) return;
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
      >
        <Icon name="camera" size={28} />
        <p className="heading-3">Drop in-game photos here</p>
        <p className="body-s muted">JPG, PNG or WebP, up to 10 MB each. We resize them to 2,000 px on the long edge.</p>
        <Button variant="secondary" icon="image" onClick={() => input.current?.click()} disabled={disabled}>
          Choose photos
        </Button>
        <input
          ref={input}
          type="file"
          accept={TYPES.join(',')}
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <p className={cx('body-s', short ? 'uploader-short' : 'muted')} role="status" aria-live="polite">
        {short ? `Add at least ${min} photos. You have ${photos.length}.` : `${photos.length} photos. Drag to reorder; the cover leads the listing.`}
      </p>

      {pending.length ? (
        <ul className="uploader-pending">
          {pending.map((p) => (
            <li key={p.key}>
              <span className="body-s">{p.name}</span>
              {p.error ? (
                <span className="uploader-error" role="alert">
                  {p.error}{' '}
                  <button type="button" className="jr-btn jr-btn--ghost jr-btn--sm" onClick={() => setPending((xs) => xs.filter((x) => x.key !== p.key))}>
                    Dismiss
                  </button>
                </span>
              ) : (
                <progress max={100} value={p.progress} aria-label={`Uploading ${p.name}`} />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="uploader-grid">
        {photos.map((p, i) => (
          <li
            key={p.id}
            className={cx('uploader-item', dragId === p.id && 'uploader-item--drag')}
            draggable={!disabled}
            onDragStart={(e) => {
              setDragId(p.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => dragId && e.preventDefault()}
            onDrop={(e) => {
              if (!dragId) return;
              e.preventDefault();
              move(dragId, i);
              setDragId(null);
            }}
          >
            <div className="uploader-thumb">
              <Image src={p.storageId} alt="" fill sizes="240px" className="photo-grade" />
              <span className="uploader-num id">{i + 1}</span>
              {p.isCover ? <span className="uploader-cover label">Cover</span> : null}
            </div>
            <div className="stack uploader-meta">
              <label className="jr-field">
                <span className="jr-field-label">Describe the photo</span>
                <input className="jr-field-input" value={p.alt} placeholder="Kitchen with island and garden view" onChange={(e) => update(p.id, { alt: e.target.value })} />
              </label>
              <label className="jr-field">
                <span className="jr-field-label">Caption (optional)</span>
                <input className="jr-field-input" value={p.caption ?? ''} onChange={(e) => update(p.id, { caption: e.target.value || null })} />
              </label>
              <div className="row">
                <label className="jr-check">
                  <input type="radio" name="cover" checked={p.isCover} onChange={() => setCover(p.id)} />
                  <span>Cover photo</span>
                </label>
                <Button size="sm" variant="ghost" onClick={() => move(p.id, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>
                  Earlier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(p.id, i + 1)} disabled={i === photos.length - 1} aria-label={`Move photo ${i + 1} later`}>
                  Later
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={async () => {
                    if (await onRemove(p.id)) {
                      const rest = latest.current.filter((x) => x.id !== p.id);
                      if (p.isCover && rest[0]) rest[0] = { ...rest[0], isCover: true };
                      onChange(rest);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
