import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfileForm } from '@/components/account/ProfileForm';
import { requireActor } from '@/server/session';

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const actor = await requireActor('/account/welcome', { allowUnonboarded: true });
  const next = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/account';
  if (actor.onboarded) redirect(next);

  return (
    <div className="stack-lg prose">
      <div className="stack">
        <span className="label label--brass">First things first</span>
        <h1 className="heading-1">Tell us who you are in-game</h1>
        <p className="body-l muted">Your Roblox username lets our agents find you for showings and settlements. Your Chirper handle is optional.</p>
      </div>
      <ProfileForm
        defaults={{ displayName: actor.displayName, robloxUsername: actor.robloxUsername ?? '', chirperHandle: '' }}
        callbackUrl={next}
        submitLabel="Save and continue"
      />
    </div>
  );
}
