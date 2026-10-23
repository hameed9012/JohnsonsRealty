import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema';
import { testAuthEnabled } from '@/lib/test-auth';

// GET /api/test-auth?user=<id>&next=/portal — mints a database session for a seeded test user.
export async function GET(req: NextRequest) {
  if (!testAuthEnabled()) return new NextResponse('Not found', { status: 404 });
  const userId = req.nextUrl.searchParams.get('user');
  const next = req.nextUrl.searchParams.get('next') || '/';
  if (!userId) return new NextResponse('user is required', { status: 400 });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return new NextResponse('Unknown user', { status: 404 });

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken: token, userId, expires });

  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', req.url));
  res.cookies.set('authjs.session-token', token, { httpOnly: true, sameSite: 'lax', path: '/', expires });
  return res;
}
