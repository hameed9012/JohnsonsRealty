import { NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { withoutDiscordIssuer } from '@/lib/auth-callback';

// Discord now adds an RFC 9207 `iss` parameter to its OAuth redirect. Auth.js (5.0.0-beta.32) compares it with the
// placeholder issuer it gives plain OAuth providers and fails every sign-in with CallbackRouteError. The check
// only guards against mix-ups between several providers; Discord is our only one, and state, PKCE and the code
// exchange are still verified, so the parameter is dropped before Auth.js reads the callback.
export async function GET(req: NextRequest) {
  const url = withoutDiscordIssuer(req.url);
  return handlers.GET(url ? new NextRequest(url, { headers: req.headers }) : req);
}

export const { POST } = handlers;
