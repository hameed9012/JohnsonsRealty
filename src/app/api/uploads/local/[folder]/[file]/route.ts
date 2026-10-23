import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const DIR = path.join(process.cwd(), '.e2e-data', 'uploads');

export async function GET(_req: Request, { params }: { params: Promise<{ folder: string; file: string }> }) {
  if (storageProvider() !== 'local') return new NextResponse('Not found', { status: 404 });
  const { folder, file } = await params;
  if (!/^[a-z]+$/.test(folder) || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(file)) return new NextResponse('Not found', { status: 404 });
  try {
    const buf = await readFile(path.join(DIR, folder, file));
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'content-type': TYPES[file.split('.').pop()!]!, 'cache-control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
