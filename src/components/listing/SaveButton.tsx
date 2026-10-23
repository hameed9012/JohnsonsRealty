'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { toggleSavedHome } from '@/server/actions/public';

/** The heart on a listing card. Signed-out visitors go to sign in and come back. */
export function SaveButton({ listingId, saved: initial, signedIn, returnTo }: { listingId: string; saved: boolean; signedIn: boolean; returnTo: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!signedIn) {
    return (
      <Link className="jr-card-save" href={`/signin?callbackUrl=${encodeURIComponent(returnTo)}`} aria-label="Sign in to save this home">
        <Icon name="heart" size={20} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="jr-card-save"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved homes' : 'Save home'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const prev = saved;
          setSaved(!prev);
          const r = await toggleSavedHome(listingId);
          if (!r.ok) setSaved(prev);
          if (r.message) toast({ message: r.message, tone: r.ok ? 'success' : 'danger' });
        })
      }
    >
      <Icon name="heart" size={20} />
    </button>
  );
}
