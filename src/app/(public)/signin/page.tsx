import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { getActor } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

function safe(cb: string | undefined) {
  return cb && cb.startsWith('/') && !cb.startsWith('//') ? cb : '/account';
}

const ERRORS: Record<string, string> = {
  AccessDenied: 'This account can’t sign in. If you think that’s wrong, contact the brokerage.',
  OAuthCallbackError: 'Discord didn’t finish signing you in. Try again.',
  Configuration: 'Sign-in isn’t set up yet. The brokerage needs to add its Discord app details.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const { callbackUrl, error } = await searchParams;
  const next = safe(callbackUrl);
  if (await getActor()) redirect(next);

  return (
    <div className="container section">
      <div className="panel stack-lg" style={{ maxWidth: 'var(--text-max)', margin: '0 auto' }}>
        <Logo />
        <div className="stack">
          <h1 className="heading-1">Sign in</h1>
          <p className="body-l muted">
            We use your Discord account, where our community lives. Signing in lets you save homes, book showings, follow your deal and list your own
            property.
          </p>
        </div>
        {error ? (
          <p className="jr-field-hint" role="alert" style={{ color: 'var(--danger)' }}>
            {ERRORS[error] ?? 'Something went wrong signing you in. Try again.'}
          </p>
        ) : null}
        <form
          action={async () => {
            'use server';
            await signIn('discord', { redirectTo: next });
          }}
        >
          <Button type="submit" withKey>
            Continue with Discord
          </Button>
        </form>
        <p className="caption muted">We only read your Discord username and avatar. We never post for you.</p>
      </div>
    </div>
  );
}
