import 'server-only';
import { createHash } from 'node:crypto';

// Image storage behind one small interface, so Cloudinary can be swapped for Vercel Blob later.
// Storage IDs are what we save in media.storage_id and pass to next/image:
//   cloudinary → the public ID ("jr/listings/abc123")
//   local      → a path served by /api/uploads/local ("/api/uploads/local/abc123.jpg")

export type UploadTarget =
  | { provider: 'cloudinary'; url: string; fields: Record<string, string> }
  | { provider: 'local'; url: string; fields: Record<string, string> };

export interface UploadedFile {
  storageId: string;
  width: number;
  height: number;
  bytes?: number;
  format?: string;
  /** Cloudinary: version and signature from the upload response, verified on the server. */
  version?: number;
  signature?: string;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Long edge on upload (Cloudinary incoming transformation). */
export const LONG_EDGE = 2000;

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  return cloud && key && secret ? { cloud, key, secret } : null;
}

export function storageProvider(): 'cloudinary' | 'local' | null {
  if (cloudinaryConfig()) return 'cloudinary';
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') return 'local';
  if (process.env.E2E_TEST_AUTH === '1' && !process.env.VERCEL) return 'local';
  return null;
}

/** Cloudinary request signing: sorted key=value pairs joined by &, then the secret, SHA-1. */
export function cloudinarySignature(params: Record<string, string | number>, secret: string): string {
  const base = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(base + secret)
    .digest('hex');
}

export function createUploadTarget(folder: 'listings' | 'agents' | 'areas' | 'site' | 'posts'): UploadTarget {
  const provider = storageProvider();
  if (provider === 'cloudinary') {
    const c = cloudinaryConfig()!;
    const params = {
      folder: `jr/${folder}`,
      timestamp: Math.floor(Date.now() / 1000),
      transformation: `c_limit,w_${LONG_EDGE},h_${LONG_EDGE},q_auto:good`,
    };
    return {
      provider,
      url: `https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`,
      fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.key, signature: cloudinarySignature(params, c.secret) },
    };
  }
  if (provider === 'local') return { provider, url: '/api/uploads/local', fields: { folder } };
  throw new Error('Photo uploads aren’t set up yet. Add the Cloudinary keys to the environment.');
}

/** Confirms an upload really came from our Cloudinary account (or our local driver) before we store it. */
export function verifyUpload(f: UploadedFile): boolean {
  const provider = storageProvider();
  if (provider === 'cloudinary') {
    const c = cloudinaryConfig()!;
    if (!f.storageId.startsWith('jr/') || !f.version || !f.signature) return false;
    return cloudinarySignature({ public_id: f.storageId, version: f.version }, c.secret) === f.signature;
  }
  if (provider === 'local') return /^\/api\/uploads\/local\/[a-z]+\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(f.storageId);
  return false;
}

/** Absolute URL for places outside next/image (Discord embeds, Open Graph, exports). */
export function publicImageUrl(storageId: string, opts: { width?: number; height?: number; crop?: boolean } = {}): string {
  if (storageId.startsWith('http')) return storageId;
  if (storageId.startsWith('/')) {
    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
    return base + storageId;
  }
  const c = cloudinaryConfig();
  const cloud = c?.cloud ?? process.env.CLOUDINARY_CLOUD_NAME;
  const t = ['f_auto', 'q_auto', opts.crop ? 'c_fill,g_auto' : 'c_limit', opts.width ? `w_${opts.width}` : '', opts.height ? `h_${opts.height}` : '']
    .filter(Boolean)
    .join(',');
  return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${storageId}`;
}

/** Uploads a file from the server (imports), with the same limits as a browser upload. */
export async function uploadFromServer(file: Buffer, type: string, folder: 'listings' | 'agents' | 'areas' | 'site' | 'posts'): Promise<Omit<UploadedFile, 'version' | 'signature'>> {
  if (!ACCEPTED_TYPES.includes(type)) throw new Error('Upload a JPG, PNG or WebP image.');
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new Error('Photos must be under 10 MB.');
  const provider = storageProvider();
  if (provider === 'cloudinary') {
    const target = createUploadTarget(folder);
    const form = new FormData();
    for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(file)], { type }));
    const res = await fetch(target.url, { method: 'POST', body: form });
    const j = (await res.json()) as { public_id?: string; width?: number; height?: number; bytes?: number; format?: string; error?: { message: string } };
    if (!res.ok || !j.public_id) throw new Error(j.error?.message ?? `Upload failed (${res.status}).`);
    return { storageId: j.public_id, width: j.width!, height: j.height!, bytes: j.bytes, format: j.format };
  }
  if (provider === 'local') {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { randomBytes } = await import('node:crypto');
    const sharp = (await import('sharp')).default;
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[type]!;
    const name = `${randomBytes(16).toString('hex')}.${ext}`;
    const dir = path.join(process.cwd(), '.e2e-data', 'uploads', folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), file);
    const meta = await sharp(file).metadata();
    return { storageId: `/api/uploads/local/${folder}/${name}`, width: meta.width ?? 0, height: meta.height ?? 0, bytes: file.byteLength, format: ext };
  }
  throw new Error('Photo uploads aren’t set up yet. Add the Cloudinary keys to the environment.');
}

export async function destroyUpload(storageId: string): Promise<void> {
  const c = cloudinaryConfig();
  if (!c || storageId.startsWith('/')) return;
  const params = { public_id: storageId, timestamp: Math.floor(Date.now() / 1000) };
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: c.key, signature: cloudinarySignature(params, c.secret) });
  await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/destroy`, { method: 'POST', body }).catch(() => {});
}
