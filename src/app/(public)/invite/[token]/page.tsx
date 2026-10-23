import type { Metadata } from 'next';
import { AcceptInvite } from '@/components/portal/InviteControls';
import { EmptyState } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { db } from '@/db/client';
import { findInvite } from '@/server/ops/invites';
import { getActor } from '@/server/session';

export const metadata: Metadata = { title: 'Join the team', robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv, actor] = await Promise.all([/^[A-Za-z0-9_-]{20,64}$/.test(token) ? findInvite(db, token) : Promise.resolve(null), getActor()]);
  return (
    <div className="container section">
      <div className="panel stack-lg" style={{ maxWidth: 'var(--text-max)', margin: '0 auto' }}>
        <Logo />
        {!inv ? (
          <EmptyState icon="key" title="This invite has expired or has been used" text="Ask the Owner for a new link." />
        ) : (
          <>
            <div className="stack">
              <span className="label label--brass">Invitation</span>
              <h1 className="heading-1">Join the team as {inv.role === 'admin' ? 'an Admin' : 'an Agent'}</h1>
              <p className="body-l muted">You’ll get access to the agent portal: listings, clients, deals and documents.</p>
            </div>
            {actor ? (
              <>
                <p className="body">Signed in as {actor.displayName}.</p>
                <AcceptInvite token={token} />
              </>
            ) : (
              <Button href={`/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} withKey>
                Sign in with Discord to accept
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
