'use client';

import { useActionState, useState, useTransition } from 'react';
import { ReferenceReceipt } from '@/components/ui/blocks';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/fields';
import { useToast } from '@/components/ui/Toaster';
import { requestShowing, toggleSavedHome } from '@/server/actions/public';

export function SaveShare({ listingId, saved: initial, signedIn, title, path }: { listingId: string; saved: boolean; signedIn: boolean; title: string; path: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      {signedIn ? (
        <Button
          variant="secondary"
          icon="heart"
          aria-pressed={saved}
          loading={pending}
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
          {saved ? 'Saved' : 'Save home'}
        </Button>
      ) : (
        <Button variant="secondary" icon="heart" href={`/signin?callbackUrl=${encodeURIComponent(path)}`}>
          Save home
        </Button>
      )}
      <Button
        variant="ghost"
        icon="share"
        onClick={async () => {
          const url = location.href;
          if (navigator.share) {
            try {
              await navigator.share({ title, url });
            } catch {}
            return;
          }
          await navigator.clipboard.writeText(url);
          toast({ message: 'Link copied' });
        }}
      >
        Share
      </Button>
    </>
  );
}

export function BookShowing({ listingId, signedIn, path, rent }: { listingId: string; signedIn: boolean; path: string; rent: boolean }) {
  const [state, action, pending] = useActionState(requestShowing.bind(null, listingId), null);
  const [when, setWhen] = useState('');
  if (!signedIn) {
    return (
      <section className="panel stack" aria-label="Book a showing">
        <h2 className="heading-3">Book a showing</h2>
        <p className="body-s muted">Sign in with Discord to pick a time. We’ll confirm it with you.</p>
        <Button href={`/signin?callbackUrl=${encodeURIComponent(path)}`} icon="calendar">
          Sign in to book
        </Button>
      </section>
    );
  }
  if (state?.ok && state.data) {
    return <ReferenceReceipt title="Showing requested" reference={state.data.refNo} text="We’ll confirm the time with you. You can follow it in your account." />;
  }
  const err = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="panel stack" aria-label="Book a showing">
      <h2 className="heading-3">Book a showing</h2>
      <TextField
        label="Preferred time"
        type="datetime-local"
        mono
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        error={err?.when}
        hint="In your local time."
        required
      />
      <input type="hidden" name="when" value={when ? new Date(when).toISOString() : ''} />
      <TextField label="Anything we should know? (optional)" name="note" multiline rows={2} error={err?.note} placeholder={rent ? 'Move-in date, pets' : 'Pre-approved, first visit'} />
      {state && !state.ok && state.message ? (
        <p className="jr-field-hint" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} icon="calendar">
        Book a showing
      </Button>
    </form>
  );
}
