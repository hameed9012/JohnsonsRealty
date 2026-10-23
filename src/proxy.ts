import { NextResponse, type NextRequest } from 'next/server';

// Coarse routing only: send visitors without a session cookie to sign in. Real authorization happens
// on the server in every page, query and action.
const COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

export function proxy(req: NextRequest) {
  const hasSession = COOKIES.some((c) => req.cookies.has(c));
  if (!hasSession) {
    const url = new URL('/signin', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/account/:path*', '/portal/:path*'] };
