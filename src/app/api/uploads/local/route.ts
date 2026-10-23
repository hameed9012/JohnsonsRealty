import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, storageProvider } from '@/lib/storage';
import { getActor } from '@/server/session';

// Local upload driver for development and end-to-end tests. Disabled whenever Cloudinary is configured
// or the app runs on Vercel.
const LOCAL_DIR =path.join(process.cwd(), '.e2e-data', 'uploads');
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FOLDERS = ['listings', 'agents', 'areas', 'site', 'posts'];

export async function POST(req: NextRequest) {
  if (storageProvider() !== 'local') return new NextResponse('Not found', { status: 404 });
  if (!(await getActor())) return NextResponse.json({ error: 'Sign in to upload photos.' }, { status: 401 });
  const form = await req.formData();
  const file = form.get('file');
  const folder = String(form.get('folder') || 'listings');
  if (!(file instanceof File) || !FOLDERS.includes(folder)) return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 });
  if (!ACCEPTED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Upload a JPG, PNG or WebP image.' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Photos must be under 10 MB.' }, { status: 400 });

  const name = `${randomBytes(16).toString('hex')}.${EXT[file.type]}`;
  await mkdir(path.join(LOCAL_DIR, folder), { recursive: true });
  await writeFile(path.join(LOCAL_DIR, folder, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ storageId: `/api/uploads/local/${folder}/${name}`, bytes: file.size, format: EXT[file.type] });
}
